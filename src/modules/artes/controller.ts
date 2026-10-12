import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  ArtePaleta, ArteEstilo, ArteAtivo, ArteTemplate, ArteTemplateVariante,
  ArteGeracao, ArteGeracaoArquivo, Solicitacao, SolicitacaoImagem, SolicitacaoComentario, Secretaria, User, Municipio,
} from '../../database/models/index.ts';
import { getActiveMid, municipioWhere } from '../../lib/municipio-filter.ts';
import { notificar } from '../../lib/notificacao.ts';
import { compor, variaveisDaVariante } from '../../lib/artes/composicao.ts';
import { validarComposicao, validarImagens, type Problema } from '../../lib/artes/validacao.ts';
import { svgParaPng, imagemParaDataUri, dirGeracoes, dirAtivos } from '../../lib/artes/render.ts';
import { PALETA_PADRAO, resolverCor, CHAVES_PALETA } from '../../lib/artes/paletas.ts';
import type { Campo, EstiloTexto, Variante, Elemento } from '../../lib/artes/types.ts';
import { getIaConfig } from '../ia/controller.ts';
import { ollamaGenerate } from '../../lib/ollama.ts';

// ── Utilidades ────────────────────────────────────────────────────────────────

function parseJson<T>(valor: any, fallback: T): T {
  if (valor && typeof valor === 'object') return valor as T;
  try { return JSON.parse(String(valor)) as T; } catch { return fallback; }
}

function slugifySimples(texto: string): string {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'modelo';
}

function ehGestor(user: any): boolean {
  return ['admin', 'secom', 'super_admin'].includes(user?.role);
}

function escopoMid(user: any, req: Request): number | null {
  const mid = getActiveMid(req);
  if (user.role === 'super_admin') return mid; // null = todos
  return user.municipio_id ?? null;
}

function whereEscopo(user: any, req: Request): Record<string, any> {
  const mid = getActiveMid(req);
  return municipioWhere(user, {}, mid);
}

function estilosParaMap(rows: ArteEstilo[]): Record<number, EstiloTexto> {
  const map: Record<number, EstiloTexto> = {};
  for (const r of rows as any[]) {
    map[r.id] = {
      familia: r.familia,
      peso: r.peso,
      tamanho: r.tamanho,
      tamanhoMin: r.tamanho_min,
      alturaLinha: r.altura_linha,
      espacamentoLetras: r.espacamento_letras,
      alinhamento: r.alinhamento,
      cor: r.cor,
      limiteLinhas: r.limite_linhas ?? null,
      margem: r.margem || 0,
      overflow: r.overflow || 'avisar',
    };
  }
  return map;
}

function varianteDaRow(row: any): Variante {
  const cfg = parseJson<{ elementos: Elemento[]; fundo?: string }>(row.config, { elementos: [] });
  return {
    chave: row.chave,
    papel: row.papel,
    nome: row.nome,
    largura: row.largura,
    altura: row.altura,
    fundo: cfg.fundo,
    elementos: Array.isArray(cfg.elementos) ? cfg.elementos : [],
  };
}

function rotuloCampo(chave: string): string {
  return String(chave).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Chaves dinâmicas referenciadas pelos textos das variantes ({{campo}} ou variavel). */
function chavesUsadas(variantes: any[]): string[] {
  const set = new Set<string>();
  for (const v of variantes || []) {
    const cfg = typeof v?.config === 'string' ? parseJson<{ elementos: any[] }>(v.config, { elementos: [] }) : (v as any);
    for (const el of ((cfg && cfg.elementos) || [])) {
      if (el.tipo !== 'texto') continue;
      if (el.variavel) set.add(String(el.variavel));
      for (const m of String(el.valor || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) set.add(m[1]);
    }
  }
  return Array.from(set);
}

/** Campos declarados + campos derivados automaticamente das chaves usadas no layout. */
function camposEfetivos(campos: Campo[], variantes: any[]): Campo[] {
  const existentes = new Set((campos || []).map((c) => c.chave));
  const extras: Campo[] = [];
  for (const chave of chavesUsadas(variantes)) {
    if (!existentes.has(chave)) {
      extras.push({ chave, rotulo: rotuloCampo(chave), tipo: /texto|descri|conteudo|body|corpo/i.test(chave) ? 'textarea' : 'texto', obrigatorio: false });
    }
  }
  return [...(campos || []), ...extras];
}

async function coresDaPaleta(paletaId: number | null): Promise<Record<string, string>> {
  if (paletaId) {
    const p = await ArtePaleta.findByPk(paletaId);
    if (p) return parseJson<Record<string, string>>((p as any).cores, { ...PALETA_PADRAO });
  }
  return { ...PALETA_PADRAO };
}

async function estilosMapGlobal(): Promise<Record<number, EstiloTexto>> {
  const rows = await ArteEstilo.findAll({ order: [['id', 'ASC']] });
  return estilosParaMap(rows as any);
}

/** Resolve os data URIs das imagens de uma variante. */
function resolverImagens(variante: Variante, ativosPorId: Map<number, string>): Record<string, string> {
  const imagens: Record<string, string> = {};
  for (const el of variante.elementos) {
    if (el.tipo !== 'imagem') continue;
    const url = (el as any).url || (el as any).ativoId ? ativosPorId.get((el as any).ativoId) : undefined;
    const ref = (el as any).url || url || null;
    const dataUri = imagemParaDataUri(ref);
    if (dataUri) imagens[el.id] = dataUri;
  }
  return imagens;
}

async function ativosMapDoMunicipio(municipioId: number | null): Promise<Map<number, string>> {
  const where: any = { url: { [Op.ne]: null } };
  if (municipioId) where.municipio_id = municipioId;
  const rows = await ArteAtivo.findAll({ where });
  const map = new Map<number, string>();
  for (const r of rows as any[]) map.set(r.id, r.url);
  return map;
}

interface ComposicaoResolvida {
  composicao: ReturnType<typeof compor>;
  imagens: Record<string, string>;
  validacao: ReturnType<typeof validarComposicao>;
}

async function comporEValidar(
  varianteRow: any,
  dados: Record<string, string>,
  paleta: Record<string, string>,
  estilos: Record<number, EstiloTexto>,
  campos: Campo[],
  ativosMap: Map<number, string>,
  varianteEsperada?: { largura: number; altura: number }
): Promise<ComposicaoResolvida> {
  const variante = varianteDaRow(varianteRow);
  const imagens = resolverImagens(variante, ativosMap);
  const composicao = compor({ variante, paleta, estilos, dados, imagens });
  const validacao = validarComposicao({
    variante, dados, paleta, campos, composicao,
    imagensResolvidas: imagens, varianteEsperada,
  });
  return { composicao, imagens, validacao };
}

async function carregarTemplate(id: number, user: any, req: Request) {
  const where: any = { id, ...whereEscopo(user, req) };
  const tpl = await ArteTemplate.findOne({
    where,
    include: [{ model: ArteTemplateVariante, as: 'variantes', separate: true, order: [['id', 'ASC']] }],
  });
  return tpl as any;
}

// ── Tela inicial do gerador ────────────────────────────────────────────────────

export const index = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where = whereEscopo(user, req);

    const [templates, geracoes, solicitacoesPendentes] = await Promise.all([
      ArteTemplate.findAll({
        where: { ...where, estado: 'publicado' },
        include: [{ model: ArteTemplateVariante, as: 'variantes' }],
        order: [['updatedAt', 'DESC']],
        limit: 12,
      }),
      ArteGeracao.findAll({
        where,
        include: [{ model: ArteTemplate, as: 'template', attributes: ['id', 'nome'] }],
        order: [['updatedAt', 'DESC']],
        limit: 8,
      }),
      isGestorOrSol(user)
        ? Solicitacao.findAll({
            where: { ...where, status: { [Op.in]: ['aprovado', 'produção'] } },
            include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome', 'cor'] }],
            order: [['createdAt', 'DESC']],
            limit: 8,
          })
        : Promise.resolve([]),
    ]);

    const categorias = Array.from(new Set((templates as any[]).map((t) => t.categoria).filter(Boolean)));

    res.render('artes/index', {
      title: 'Estúdio de Artes',
      templates,
      geracoes,
      solicitacoesPendentes,
      categorias,
      podeAdministrar: ehGestor(user),
    });
  } catch (error) {
    console.error('Erro artes/index:', error);
    res.status(500).send('Internal Server Error');
  }
};

function isGestorOrSol(user: any): boolean {
  return ['admin', 'secom', 'super_admin', 'secretaria'].includes(user?.role);
}

// ── Administração de modelos ───────────────────────────────────────────────────

export const modelosList = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
    const where = whereEscopo(user, req);
    const templates = await ArteTemplate.findAll({
      where,
      include: [{ model: ArteTemplateVariante, as: 'variantes' }],
      order: [['updatedAt', 'DESC']],
    });
    res.render('artes/modelos', { title: 'Modelos de arte', templates, ok: req.query.ok || '', erro: req.query.erro || '' });
  } catch (error) {
    console.error('Erro artes/modelos:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloNovo = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
    const paletas = await ArtePaleta.findAll({ where: { estado: { [Op.ne]: 'arquivado' }, ...municipioWhere(user, {}, getActiveMid(req)) }, order: [['nome', 'ASC']] });
    const estilos = await ArteEstilo.findAll({ order: [['nome', 'ASC']] });
    const solicitacoes = await Solicitacao.findAll({ where: whereEscopo(user, req), order: [['createdAt', 'DESC']], limit: 40, attributes: ['id', 'titulo', 'descricao', 'prazo'], include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome'] }] });
    res.render('artes/modelo-form', {
      title: 'Novo modelo',
      template: null,
      variantesJson: '[]',
      paletas,
      estilos,
      paletaCores: { ...PALETA_PADRAO },
      solicitacoes,
      solicitacoesJson: JSON.stringify((solicitacoes as any[]).map((s) => ({ id: s.id, titulo: s.titulo, descricao: s.descricao, prazo: s.prazo, secretaria: (s.secretaria ? s.secretaria.nome : '') }))),
      modo: 'criar',
    });
  } catch (error) {
    console.error('Erro artes/modelo-novo:', error);
    res.status(500).send('Internal Server Error');
  }
};

function montarVariante(chave: string, papel: string, nome: string, largura: number, altura: number, elementos: Elemento[] = []) {
  return { chave, papel, nome, largura, altura, config: JSON.stringify({ elementos }) };
}

export const modeloStore = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const mid = escopoMid(user, req);
    const { nome, descricao, categoria, paleta_id } = req.body;
    const carrossel = req.body.carrossel === 'on' || req.body.carrossel === '1' || req.body.carrossel === true;
    const formatosReq: string[] = Array.isArray(req.body.formatos) ? req.body.formatos : (req.body.formatos ? [req.body.formatos] : ['9:16']);
    const camposBase = parseJson<Campo[]>(req.body.campos_json, []);
    const variantesJson = parseJson<any[]>(req.body.variantes_json, null);

    let variantes: any[] = [];
    let formatos: string[] = formatosReq;
    if (Array.isArray(variantesJson) && variantesJson.length) {
      // Vem do editor visual — preserva tudo o que foi montado (evita perder o trabalho).
      variantes = variantesJson.map((v) => ({
        chave: String(v.chave || '9:16'),
        papel: String(v.papel || 'principal'),
        nome: String(v.nome || v.chave || 'Variante'),
        largura: Number(v.largura) || 1080,
        altura: Number(v.altura) || 1920,
        config: JSON.stringify({ elementos: Array.isArray(v.elementos) ? v.elementos : [], fundo: v.fundo || undefined }),
      }));
      const derivados = Array.from(new Set(variantes.map((v) => v.chave).filter((c) => c === '9:16' || c === '3:4')));
      if (derivados.length) formatos = derivados;
    } else {
      if (formatosReq.includes('9:16')) variantes.push(montarVariante('9:16', 'principal', 'Vertical 9:16', 1080, 1920));
      if (formatosReq.includes('3:4')) variantes.push(montarVariante('3:4', 'principal', 'Retrato 3:4', 1080, 1440));
      if (carrossel) {
        if (!variantes.some((v) => v.chave === '3:4')) variantes.push(montarVariante('3:4', 'principal', 'Retrato 3:4', 1080, 1440));
        variantes.push(montarVariante('capa', 'capa', 'Capa do carrossel', 1080, 1440));
        variantes.push(montarVariante('interna', 'interna', 'Página interna', 1080, 1440));
      }
    }
    const campos = camposEfetivos(camposBase, variantes);

    const tpl = await ArteTemplate.create({
      municipio_id: mid ?? user.municipio_id,
      nome: String(nome || 'Novo modelo').slice(0, 120),
      slug: slugifySimples(nome) + '-' + Date.now().toString(36),
      descricao: descricao || null,
      categoria: categoria || 'Institucional',
      estado: 'rascunho',
      versao: 1,
      paleta_id: paleta_id ? Number(paleta_id) : null,
      formatos: JSON.stringify(formatos),
      campos: JSON.stringify(campos),
      carrossel,
      autor_id: user.id,
    } as any);

    await ArteTemplateVariante.bulkCreate(variantes.map((v) => ({ ...v, template_id: tpl.id })) as any);

    res.redirect(`/artes/modelos/${tpl.id}/editar`);
  } catch (error) {
    console.error('Erro artes/modelo-store:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloEditar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).redirect('/artes/modelos');
    const paletas = await ArtePaleta.findAll({ where: { estado: { [Op.ne]: 'arquivado' }, ...municipioWhere(user, {}, getActiveMid(req)) }, order: [['nome', 'ASC']] });
    const estilos = await ArteEstilo.findAll({ order: [['nome', 'ASC']] });
    const paletaCores = await coresDaPaleta(tpl.paleta_id);
    const solicitacoes = await Solicitacao.findAll({ where: whereEscopo(user, req), order: [['createdAt', 'DESC']], limit: 40, attributes: ['id', 'titulo', 'descricao', 'prazo'], include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome'] }] });
    res.render('artes/modelo-form', {
      title: `Editar modelo — ${tpl.nome}`,
      template: tpl,
      variantesJson: JSON.stringify((tpl.variantes || []).map((v: any) => ({
        id: v.id, chave: v.chave, papel: v.papel, nome: v.nome, largura: v.largura, altura: v.altura,
        fundo: parseJson<any>(v.config, {}).fundo,
        elementos: parseJson<any>(v.config, { elementos: [] }).elementos || [],
      }))),
      paletas,
      estilos,
      paletaCores,
      solicitacoes,
      solicitacoesJson: JSON.stringify((solicitacoes as any[]).map((s) => ({ id: s.id, titulo: s.titulo, descricao: s.descricao, prazo: s.prazo, secretaria: (s.secretaria ? s.secretaria.nome : '') }))),
      modo: 'editar',
    });
  } catch (error) {
    console.error('Erro artes/modelo-editar:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloUpdate = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).json({ ok: false, error: 'Modelo não encontrado' });

    const { nome, descricao, categoria, paleta_id } = req.body;
    const camposBase = parseJson<Campo[]>(req.body.campos_json, parseJson<Campo[]>(tpl.campos, []));
    const variantes = parseJson<any[]>(req.body.variantes_json, null);
    // Garante que todo {{campo}} usado no layout vire um campo dinâmico.
    const campos = camposEfetivos(camposBase, Array.isArray(variantes) ? variantes : (tpl.variantes || []));

    await tpl.update({
      nome: nome ? String(nome).slice(0, 120) : tpl.nome,
      descricao: descricao ?? tpl.descricao,
      categoria: categoria || tpl.categoria,
      paleta_id: paleta_id ? Number(paleta_id) : tpl.paleta_id,
      campos: JSON.stringify(campos),
      formatos: JSON.stringify(Array.from(new Set((variantes || []).map((v) => v.chave).filter((c) => c === '9:16' || c === '3:4')))),
    });

    if (Array.isArray(variantes)) {
      for (const v of variantes) {
        const dados = {
          chave: String(v.chave || '9:16'),
          papel: String(v.papel || 'principal'),
          nome: String(v.nome || v.chave || 'Variante'),
          largura: Number(v.largura) || 1080,
          altura: Number(v.altura) || 1920,
          config: JSON.stringify({ elementos: Array.isArray(v.elementos) ? v.elementos : [], fundo: v.fundo || undefined }),
        };
        if (v.id) {
          const row = await ArteTemplateVariante.findOne({ where: { id: Number(v.id), template_id: tpl.id } });
          if (row) await row.update(dados);
        } else {
          await ArteTemplateVariante.create({ ...dados, template_id: tpl.id } as any);
        }
      }
    }

    res.redirect(`/artes/modelos/${tpl.id}/editar?ok=1`);
  } catch (error) {
    console.error('Erro artes/modelo-update:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloPublicar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).json({ ok: false });
    const variantes = tpl.variantes || [];
    if (variantes.length === 0 || variantes.every((v: any) => (parseJson<any>(v.config, { elementos: [] }).elementos || []).length === 0)) {
      return res.redirect('/artes/modelos?erro=sem_elementos');
    }
    const eraPublicado = tpl.estado === 'publicado';
    await tpl.update({ estado: 'publicado', versao: eraPublicado ? tpl.versao : tpl.versao + 1 });
    res.redirect('/artes/modelos?ok=publicado');
  } catch (error) {
    console.error('Erro artes/modelo-publicar:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloArquivar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).json({ ok: false });
    await tpl.update({ estado: 'arquivado' });
    res.redirect('/artes/modelos?ok=arquivado');
  } catch (error) {
    console.error('Erro artes/modelo-arquivar:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const modeloExcluir = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false, error: 'Sem permissão' });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).json({ ok: false, error: 'Modelo não encontrado' });

    const geracoes = await ArteGeracao.count({ where: { template_id: tpl.id } });
    if (geracoes > 0) {
      return res.status(400).json({ ok: false, error: `Este modelo já gerou ${geracoes} arte(s). Arquive-o em vez de excluir, para preservar o histórico.` });
    }

    await ArteTemplateVariante.destroy({ where: { template_id: tpl.id } });
    await tpl.destroy();

    if (req.headers.accept?.includes('application/json')) return res.json({ ok: true });
    res.redirect('/artes/modelos?ok=excluido');
  } catch (error) {
    console.error('Erro artes/modelo-excluir:', error);
    res.status(500).json({ ok: false, error: 'Erro ao excluir.' });
  }
};

export const modeloDuplicar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).json({ ok: false });
    const novo = await ArteTemplate.create({
      municipio_id: tpl.municipio_id,
      nome: `${tpl.nome} (cópia)`,
      slug: slugifySimples(tpl.nome) + '-' + Date.now().toString(36),
      descricao: tpl.descricao,
      categoria: tpl.categoria,
      estado: 'rascunho',
      versao: 1,
      paleta_id: tpl.paleta_id,
      formatos: tpl.formatos,
      campos: tpl.campos,
      regras: tpl.regras,
      carrossel: tpl.carrossel,
      autor_id: user.id,
    } as any);
    for (const v of (tpl.variantes || [])) {
      await ArteTemplateVariante.create({
        template_id: novo.id, chave: v.chave, papel: v.papel, nome: v.nome,
        largura: v.largura, altura: v.altura, config: v.config,
      } as any);
    }
    res.redirect(`/artes/modelos/${novo.id}/editar`);
  } catch (error) {
    console.error('Erro artes/modelo-duplicar:', error);
    res.status(500).send('Internal Server Error');
  }
};

function amostraCampo(c: Campo): string {
  if (c.tipo === 'data') return new Date().toLocaleDateString('pt-BR');
  if (c.tipo === 'hora') return '19h';
  if (c.tipo === 'url') return 'municipio.gov.br';
  return c.rotulo || c.chave;
}

/** Miniatura SVG de uma variante do modelo (usada nas listagens). */
export const modeloThumb = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const tpl = await carregarTemplate(Number(req.params.id), user, req);
    if (!tpl) return res.status(404).send('Não encontrado');
    const chave = String(req.params.chave || '9:16');
    const varianteRow = (tpl.variantes || []).find((v: any) => v.chave === chave) || (tpl.variantes || [])[0];
    if (!varianteRow) return res.status(404).send('Sem variante');
    const campos = camposEfetivos(parseJson<Campo[]>(tpl.campos, []), tpl.variantes || []);
    const dadosAmostra: Record<string, string> = {};
    for (const c of campos) dadosAmostra[c.chave] = amostraCampo(c);
    const paleta = await coresDaPaleta(tpl.paleta_id);
    const estilos = await estilosMapGlobal();
    const ativosMap = await ativosMapDoMunicipio(tpl.municipio_id);
    const { composicao } = await comporEValidar(varianteRow, dadosAmostra, paleta, estilos, campos, ativosMap);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.send(composicao.svg);
  } catch (error) {
    console.error('Erro artes/modeloThumb:', error);
    res.status(500).send('Erro');
  }
};

// ── Biblioteca de ativos ───────────────────────────────────────────────────────
/** Quantos modelos referenciam uma determinada URL de ativo. */
async function usosPorUrl(): Promise<(url: string) => number> {
  const variantes = await ArteTemplateVariante.findAll({ attributes: ['config'] });
  const configs = (variantes as any[]).map((v) => String(v.config || ''));
  return (url: string) => configs.filter((c) => c.includes(url)).length;
}

export const ativosList = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
    const where: any = { ...whereEscopo(user, req) };
    const { categoria, tipo, q, tag, estado } = req.query as Record<string, string>;
    if (categoria) where.categoria = categoria;
    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;
    if (q) where.nome = { [Op.like]: `%${q}%` };
    if (tag) where.tags = { [Op.like]: `%${tag}%` };
    const ativos = await ArteAtivo.findAll({ where, order: [['createdAt', 'DESC']] });
    const contarUso = await usosPorUrl();
    const usos: Record<number, number> = {};
    const tagsSet = new Set<string>();
    for (const a of ativos as any[]) {
      if (a.url) usos[a.id] = contarUso(a.url);
      if (a.tags) String(a.tags).split(',').map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => tagsSet.add(t));
    }
    const categorias = Array.from(new Set((ativos as any[]).map((a) => a.categoria))).sort();
    res.render('artes/ativos', {
      title: 'Biblioteca de elementos',
      ativos,
      categorias,
      tags: Array.from(tagsSet).sort(),
      usos,
      filtros: { categoria: categoria || '', tipo: tipo || '', q: q || '', tag: tag || '', estado: estado || '' },
      ok: req.query.ok || '',
    });
  } catch (error) {
    console.error('Erro artes/ativos:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const ativosJson = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where: any = { ...whereEscopo(user, req), url: { [Op.ne]: null } };
    const ativos = await ArteAtivo.findAll({ where, order: [['nome', 'ASC']] });
    res.json((ativos as any[]).map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, categoria: a.categoria, tags: a.tags, url: a.url })));
  } catch {
    res.json([]);
  }
};

export const ativoStore = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const mid = escopoMid(user, req) ?? user.municipio_id;
    const file = (req as any).file;
    const { nome, categoria, tipo, descricao, tags, alt, uso_institucional } = req.body;

    let url: string | null = null;
    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const nomeArq = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      const destino = path.join(dirAtivos(), nomeArq);
      if (file.path && fs.existsSync(file.path)) fs.renameSync(file.path, destino);
      else if (file.buffer) fs.writeFileSync(destino, file.buffer);
      url = `/uploads/artes/ativos/${nomeArq}`;
    }

    const ativo = await ArteAtivo.create({
      municipio_id: mid,
      nome: String(nome || (file ? file.originalname : 'Elemento')).slice(0, 120),
      categoria: categoria || 'Geral',
      tipo: tipo || 'imagem',
      descricao: descricao || null,
      url,
      mime_type: file?.mimetype || null,
      tags: tags || null,
      alt: alt || null,
      uso_institucional: uso_institucional === 'on' || uso_institucional === '1' || uso_institucional === true,
      estado: 'publicado',
      autor_id: user.id,
    } as any);

    if (req.headers.accept?.includes('application/json')) return res.json({ ok: true, ativo });
    res.redirect('/artes/ativos?ok=1');
  } catch (error) {
    console.error('Erro artes/ativo-store:', error);
    res.status(500).json({ ok: false, error: 'Falha ao salvar o elemento.' });
  }
};

export const ativoUpdate = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const ativo = await ArteAtivo.findOne({ where: { id: Number(req.params.id), ...whereEscopo(user, req) } });
    if (!ativo) return res.status(404).json({ ok: false });
    const { nome, categoria, tipo, descricao, tags, alt, estado, uso_institucional } = req.body;
    await ativo.update({
      nome: nome || (ativo as any).nome,
      categoria: categoria || (ativo as any).categoria,
      tipo: tipo || (ativo as any).tipo,
      descricao: descricao ?? (ativo as any).descricao,
      tags: tags ?? (ativo as any).tags,
      alt: alt ?? (ativo as any).alt,
      estado: estado || (ativo as any).estado,
      uso_institucional: uso_institucional === undefined ? (ativo as any).uso_institucional : (uso_institucional === 'on' || uso_institucional === '1' || uso_institucional === true),
    });
    if (req.headers.accept?.includes('application/json')) return res.json({ ok: true, ativo });
    res.redirect('/artes/ativos?ok=1');
  } catch (error) {
    console.error('Erro artes/ativo-update:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const ativoExcluir = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const ativo = await ArteAtivo.findOne({ where: { id: Number(req.params.id), ...whereEscopo(user, req) } });
    if (!ativo) return res.status(404).json({ ok: false, error: 'Elemento não encontrado.' });
    const url = (ativo as any).url as string | null;
    if (url) {
      const contarUso = await usosPorUrl();
      const usos = contarUso(url);
      if (usos > 0 && req.body?.forcar !== '1') {
        return res.status(400).json({ ok: false, error: `Este elemento está em uso por ${usos} modelo(s). Arquive-o em vez de excluir.` });
      }
      try {
        const abs = path.join(process.cwd(), 'public', String(url).replace(/^\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch { /* ignora */ }
    }
    await ativo.destroy();
    if (req.headers.accept?.includes('application/json')) return res.json({ ok: true });
    res.redirect('/artes/ativos?ok=1');
  } catch (error) {
    console.error('Erro artes/ativo-excluir:', error);
    res.status(500).json({ ok: false, error: 'Erro ao excluir.' });
  }
};

export const ativoArquivar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const ativo = await ArteAtivo.findOne({ where: { id: Number(req.params.id), ...whereEscopo(user, req) } });
    if (!ativo) return res.status(404).json({ ok: false });
    await ativo.update({ estado: (ativo as any).estado === 'arquivado' ? 'publicado' : 'arquivado' });
    res.redirect('/artes/ativos?ok=1');
  } catch (error) {
    console.error('Erro artes/ativo-arquivar:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── Paletas e estilos ──────────────────────────────────────────────────────────

export const paletasList = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
    const [paletas, estilos] = await Promise.all([
      ArtePaleta.findAll({ where: whereEscopo(user, req), order: [['nome', 'ASC']] }),
      ArteEstilo.findAll({ order: [['nome', 'ASC']] }),
    ]);
    res.render('artes/paletas', {
      title: 'Paletas e estilos',
      paletas,
      estilos,
      chaves: CHAVES_PALETA,
      paletaPadrao: PALETA_PADRAO,
      ok: req.query.ok || '',
    });
  } catch (error) {
    console.error('Erro artes/paletas:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const paletaStore = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const mid = escopoMid(user, req) ?? user.municipio_id;
    const cores: Record<string, string> = {};
    for (const chave of CHAVES_PALETA) cores[chave] = req.body[`cor_${chave}`] || PALETA_PADRAO[chave];
    const { nome, descricao, tematica } = req.body;

    if (req.body.id) {
      const p = await ArtePaleta.findOne({ where: { id: Number(req.body.id), ...whereEscopo(user, req) } });
      if (!p) return res.status(404).json({ ok: false });
      await p.update({ nome, descricao, cores: JSON.stringify(cores), tematica: !!tematica });
    } else {
      await ArtePaleta.create({
        municipio_id: mid,
        nome: String(nome || 'Nova paleta'),
        slug: slugifySimples(nome) + '-' + Date.now().toString(36),
        descricao: descricao || null,
        cores: JSON.stringify(cores),
        tematica: !!tematica,
        estado: 'publicado',
      } as any);
    }
    res.redirect('/artes/paletas?ok=1');
  } catch (error) {
    console.error('Erro artes/paleta-store:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const estiloStore = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!ehGestor(user)) return res.status(403).json({ ok: false });
    const mid = escopoMid(user, req) ?? user.municipio_id;
    const dados = {
      nome: String(req.body.nome || 'Estilo'),
      familia: req.body.familia || 'Inter, system-ui, sans-serif',
      peso: Number(req.body.peso) || 700,
      tamanho: Number(req.body.tamanho) || 64,
      tamanho_min: Number(req.body.tamanho_min) || 28,
      altura_linha: Number(req.body.altura_linha) || 1.15,
      espacamento_letras: Number(req.body.espacamento_letras) || 0,
      alinhamento: req.body.alinhamento || 'left',
      cor: req.body.cor || 'text',
      limite_linhas: req.body.limite_linhas ? Number(req.body.limite_linhas) : null,
      margem: Number(req.body.margem) || 0,
      overflow: req.body.overflow || 'avisar',
    };
    if (req.body.id) {
      const e = await ArteEstilo.findByPk(Number(req.body.id));
      if (!e) return res.status(404).json({ ok: false });
      await e.update(dados);
    } else {
      await ArteEstilo.create({ ...dados, municipio_id: mid, estado: 'publicado' } as any);
    }
    res.redirect('/artes/paletas?ok=1');
  } catch (error) {
    console.error('Erro artes/estilo-store:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── Produção e geração ─────────────────────────────────────────────────────────

export const producaoView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where = whereEscopo(user, req);
    const tplId = Number(req.query.template_id) || 0;
    const solicitacaoId = Number(req.query.solicitacao_id) || 0;

    const templates = await ArteTemplate.findAll({
      where: { ...where, estado: 'publicado' },
      include: [{ model: ArteTemplateVariante, as: 'variantes' }],
      order: [['nome', 'ASC']],
    });

    let template: any = null;
    if (tplId) template = (templates as any[]).find((t) => t.id === tplId) || await carregarTemplate(tplId, user, req);

    let solicitacao: any = null;
    if (solicitacaoId) {
      solicitacao = await Solicitacao.findOne({ where: { id: solicitacaoId, ...where }, include: [{ model: Secretaria, as: 'secretaria' }] });
    }

    // Sugere um modelo compatível com o tipo de mídia da solicitação, quando nenhum foi escolhido.
    let sugestaoAutomatica = false;
    if (!template && solicitacao && (templates as any[]).length) {
      const alvo = String(solicitacao.tipo_midia || '').toLowerCase();
      const match = (templates as any[]).find((t) => {
        const cat = String(t.categoria || '').toLowerCase();
        return cat && (cat.includes(alvo) || alvo.includes(cat));
      });
      if (match) { template = match; sugestaoAutomatica = true; }
    }

    const paleta = template ? await coresDaPaleta(template.paleta_id) : { ...PALETA_PADRAO };

    res.render('artes/producao', {
      title: 'Produzir arte',
      templates,
      template,
      solicitacao,
      paleta,
      variantesJson: template ? JSON.stringify((template.variantes || []).map((v: any) => ({
        id: v.id, chave: v.chave, papel: v.papel, nome: v.nome, largura: v.largura, altura: v.altura,
        elementos: parseJson<any>(v.config, { elementos: [] }).elementos || [],
      }))) : '[]',
      campos: template ? camposEfetivos(parseJson<Campo[]>(template.campos, []), template.variantes || []) : [],
      podeAdministrar: ehGestor(user),
      sugestaoAutomatica,
    });
  } catch (error) {
    console.error('Erro artes/producao:', error);
    res.status(500).send('Internal Server Error');
  }
};

/** Prévia: recompõe a variante com os dados enviados e devolve o SVG. */
export const previa = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const templateId = Number(req.body.template_id);
    const chave = String(req.body.chave || '9:16');
    const dados = parseJson<Record<string, string>>(req.body.dados, {});
    const tpl = await carregarTemplate(templateId, user, req);
    if (!tpl) return res.status(404).json({ ok: false, error: 'Modelo não encontrado' });

    const varianteRow = (tpl.variantes || []).find((v: any) => v.chave === chave) || (tpl.variantes || [])[0];
    if (!varianteRow) return res.status(400).json({ ok: false, error: 'Variante não encontrada' });

    const paleta = await coresDaPaleta(tpl.paleta_id);
    const estilos = await estilosMapGlobal();
    const ativosMap = await ativosMapDoMunicipio(tpl.municipio_id);
    const campos = camposEfetivos(parseJson<Campo[]>(tpl.campos, []), tpl.variantes || []);
    const { composicao, validacao } = await comporEValidar(varianteRow, dados, paleta, estilos, campos, ativosMap);

    res.json({
      ok: true,
      svg: composicao.svg,
      largura: composicao.largura,
      altura: composicao.altura,
      bloqueadores: validacao.bloqueadores,
      avisos: validacao.avisos,
    });
  } catch (error) {
    console.error('Erro artes/previa:', error);
    res.status(500).json({ ok: false, error: 'Falha ao gerar a prévia.' });
  }
};

interface SaidaGerada {
  papel: string;
  formato: string;
  pagina: number;
  largura: number;
  altura: number;
  svg: string;
  problemas: { bloqueadores: Problema[]; avisos: Problema[] };
}

/** Monta as saídas (formatos/páginas) e compõe cada uma. */
async function montarSaidas(
  tpl: any,
  modalidade: string,
  dados: Record<string, string>,
  paginas: { titulo: string; texto: string }[]
): Promise<SaidaGerada[]> {
  const paleta = await coresDaPaleta(tpl.paleta_id);
  const estilos = await estilosMapGlobal();
  const ativosMap = await ativosMapDoMunicipio(tpl.municipio_id);
  const campos = camposEfetivos(parseJson<Campo[]>(tpl.campos, []), tpl.variantes || []);
  const variantes = tpl.variantes || [];
  const porChave = new Map<string, any>();
  for (const v of variantes as any[]) porChave.set(v.chave, v);

  const saidas: SaidaGerada[] = [];

  const comporChave = async (varianteRow: any, dadosPagina: Record<string, string>, papel: string, pagina: number) => {
    const { composicao, validacao } = await comporEValidar(varianteRow, dadosPagina, paleta, estilos, campos, ativosMap);
    saidas.push({
      papel,
      formato: varianteRow.chave,
      pagina,
      largura: varianteRow.largura,
      altura: varianteRow.altura,
      svg: composicao.svg,
      problemas: { bloqueadores: validacao.bloqueadores, avisos: validacao.avisos },
    });
  };

  if (modalidade === 'carrossel') {
    const capa = porChave.get('capa') || porChave.get('3:4') || porChave.get('9:16');
    const interna = porChave.get('interna') || porChave.get('3:4') || porChave.get('9:16');
    if (!capa || !interna) return saidas;
    const lista = paginas.length ? paginas : [{ titulo: dados.titulo || '', texto: dados.texto || '' }];
    for (let i = 0; i < lista.length; i++) {
      const pg = lista[i];
      const dadosPg = { ...dados, titulo: pg.titulo || dados.titulo || '', texto: pg.texto || dados.texto || '' };
      await comporChave(i === 0 ? capa : interna, dadosPg, i === 0 ? 'capa' : 'interna', i + 1);
    }
  } else {
    const chaves = modalidade === 'duplo' ? ['9:16', '3:4'] : ['9:16'];
    for (const chave of chaves) {
      const row = porChave.get(chave);
      if (!row) continue;
      await comporChave(row, dados, 'principal', 1);
    }
  }

  return saidas;
}

export const gerar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const templateId = Number(req.body.template_id);
    const modalidade = String(req.body.modalidade || 'unico');
    const solicitacaoId = req.body.solicitacao_id ? Number(req.body.solicitacao_id) : null;
    const dados = parseJson<Record<string, string>>(req.body.dados, {});
    const paginas = parseJson<{ titulo: string; texto: string }[]>(req.body.paginas, []);

    const tpl = await carregarTemplate(templateId, user, req);
    if (!tpl) return res.status(404).json({ ok: false, error: 'Modelo não encontrado' });
    if (tpl.estado !== 'publicado' && !ehGestor(user)) {
      return res.status(403).json({ ok: false, error: 'Modelo não publicado.' });
    }

    const saidas = await montarSaidas(tpl, modalidade, dados, paginas);
    if (saidas.length === 0) {
      return res.status(400).json({ ok: false, error: 'Nenhum formato compatível com o modelo foi encontrado.' });
    }

    const bloqueadoresTotais = saidas.flatMap((s) => s.problemas.bloqueadores);
    const avisosTotais = saidas.flatMap((s) => s.problemas.avisos);

    const geracao = await ArteGeracao.create({
      municipio_id: tpl.municipio_id,
      template_id: tpl.id,
      template_versao: tpl.versao,
      solicitacao_id: solicitacaoId,
      usuario_id: user.id,
      titulo: dados.titulo || tpl.nome,
      modalidade,
      estado: bloqueadoresTotais.length ? 'rascunho' : 'gerado',
      dados: JSON.stringify(solicitacaoId ? { ...dados, __paginas: paginas } : { ...dados, __paginas: paginas }),
      formatos: JSON.stringify(saidas.map((s) => ({ formato: s.formato, papel: s.papel, pagina: s.pagina, largura: s.largura, altura: s.altura }))),
      validacoes: JSON.stringify({ bloqueadores: bloqueadoresTotais, avisos: avisosTotais }),
    } as any);

    const dir = dirGeracoes();
    let primeiraUrl: string | null = null;
    for (const s of saidas) {
      const base = `${geracao.id}-${s.papel}-${s.formato.replace(':', 'x')}-${s.pagina}`;
      let urlPng: string | null = null;
      try {
        const png = await svgParaPng(s.svg, s.largura, s.altura);
        const nomeArq = `${base}.png`;
        fs.writeFileSync(path.join(dir, nomeArq), png);
        urlPng = `/uploads/artes/geracoes/${nomeArq}`;
        if (!primeiraUrl) primeiraUrl = urlPng;
      } catch (e) {
        console.error('Falha ao renderizar PNG, mantendo SVG:', (e as Error).message);
      }
      await ArteGeracaoArquivo.create({
        geracao_id: geracao.id,
        papel: s.papel,
        formato: s.formato,
        largura: s.largura,
        altura: s.altura,
        url: urlPng || `/artes/geracoes/${geracao.id}/svg/${s.pagina}`,
        pagina: s.pagina,
      } as any);
    }
    void primeiraUrl;

    res.json({ ok: true, id: geracao.id, bloqueadores: bloqueadoresTotais, avisos: avisosTotais, redireciona: `/artes/geracoes/${geracao.id}` });
  } catch (error) {
    console.error('Erro artes/gerar:', error);
    res.status(500).json({ ok: false, error: 'Falha ao gerar a arte.' });
  }
};

export const geracaoView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const geracao = await ArteGeracao.findOne({
      where: { id: Number(req.params.id), ...whereEscopo(user, req) },
      include: [
        { model: ArteGeracaoArquivo, as: 'arquivos' },
        { model: ArteTemplate, as: 'template', include: [{ model: ArteTemplateVariante, as: 'variantes' }] },
        { model: Solicitacao, as: 'solicitacao' },
      ],
    });
    if (!geracao) return res.status(404).redirect('/artes');
    res.render('artes/geracao', {
      title: `Arte #${geracao.id}`,
      geracao,
      validacoes: parseJson<any>((geracao as any).validacoes, { bloqueadores: [], avisos: [] }),
      dados: parseJson<Record<string, string>>((geracao as any).dados, {}),
    });
  } catch (error) {
    console.error('Erro artes/geracaoView:', error);
    res.status(500).send('Internal Server Error');
  }
};

/** Recupera o SVG de uma página (fallback quando o PNG não pôde ser rasterizado). */
export const geracaoSvg = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const geracao = await ArteGeracao.findOne({
      where: { id: Number(req.params.id), ...whereEscopo(user, req) },
      include: [{ model: ArteTemplate, as: 'template', include: [{ model: ArteTemplateVariante, as: 'variantes' }] }],
    });
    if (!geracao) return res.status(404).send('Não encontrado');
    const pagina = Number(req.params.pagina) || 1;
    const dados = parseJson<any>((geracao as any).dados, {});
    const paginas = Array.isArray(dados.__paginas) ? dados.__paginas : [];
    const tpl = (geracao as any).template;
    const saidas = await montarSaidas(tpl, (geracao as any).modalidade, dados, paginas);
    const alvo = saidas.find((s) => s.pagina === pagina) || saidas[0];
    if (!alvo) return res.status(404).send('Sem composição');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(alvo.svg);
  } catch (error) {
    console.error('Erro artes/geracaoSvg:', error);
    res.status(500).send('Erro ao compor SVG');
  }
};

export const geracaoAprovar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const geracao = await ArteGeracao.findOne({
      where: { id: Number(req.params.id), ...whereEscopo(user, req) },
      include: [
        { model: ArteGeracaoArquivo, as: 'arquivos' },
        { model: ArteTemplate, as: 'template', attributes: ['id', 'nome', 'versao'] },
      ],
    });
    if (!geracao) return res.status(404).redirect('/artes');

    const validacoes = parseJson<any>((geracao as any).validacoes, { bloqueadores: [], avisos: [] });
    if ((validacoes.bloqueadores || []).length > 0 && req.body.forcar !== '1') {
      return res.status(400).json({ ok: false, error: 'Existem bloqueadores. Resolva-os antes de aprovar.' });
    }

    await geracao.update({ estado: 'aprovado' });

    // Integração com a Biblioteca de Artes: anexa os PNGs à solicitação de origem.
    const solicitacaoId = (geracao as any).solicitacao_id;
    let arquivosAnexados = 0;
    let primeiraUrl: string | null = null;
    if (solicitacaoId) {
      const sol = await Solicitacao.findOne({ where: { id: solicitacaoId, ...whereEscopo(user, req) } });
      if (sol) {
        const maxOrdem = (await SolicitacaoImagem.max('ordem', { where: { solicitacao_id: solicitacaoId } })) as number | null;
        let base = (typeof maxOrdem === 'number' ? maxOrdem : -1) + 1;
        for (const arq of ((geracao as any).arquivos || [])) {
          if (!String(arq.url || '').endsWith('.png')) continue;
          await SolicitacaoImagem.create({
            solicitacao_id: solicitacaoId,
            url: arq.url,
            nome: `arte-${geracao.id}-${arq.papel}-${arq.formato.replace(':', 'x')}-${arq.pagina}.png`,
            ordem: base++,
          } as any);
          arquivosAnexados++;
          if (!primeiraUrl) primeiraUrl = arq.url;
        }
        if (!(sol as any).arte_final_url && primeiraUrl) {
          await sol.update({ arte_final_url: primeiraUrl, arte_final_nome: `arte-${geracao.id}.png` });
        }
        if (arquivosAnexados > 0) {
          const nomeTpl = (geracao as any).template?.nome || 'modelo';
          const versao = (geracao as any).template_versao;
          await SolicitacaoComentario.create({
            solicitacao_id: solicitacaoId,
            autor_id: user.id,
            tipo: 'conclusao',
            texto: `Arte gerada no Estúdio de Artes a partir do modelo "${nomeTpl}" (v${versao}) — ${arquivosAnexados} arquivo(s).`,
            arquivo_url: primeiraUrl,
            arquivo_nome: primeiraUrl ? `arte-${geracao.id}.png` : null,
          } as any);
          // Avança o fluxo para "concluído" (material entregue) quando ainda não estava encerrado.
          if (!['concluído', 'finalizado', 'cancelado'].includes(String((sol as any).status))) {
            await sol.update({ status: 'concluído' });
          }
          if ((sol as any).criado_por) {
            notificar((sol as any).criado_por, {
              titulo: 'Material disponível para revisão',
              corpo: `"${(sol as any).titulo}" está pronto para revisão.`,
              url: `/solicitacoes/${solicitacaoId}`,
              tipo: 'solicitacao_concluida',
            }).catch(() => {});
          }
        }
      }
    }

    res.json({ ok: true, arquivosAnexados });
  } catch (error) {
    console.error('Erro artes/geracaoAprovar:', error);
    res.status(500).json({ ok: false, error: 'Erro ao aprovar.' });
  }
};

export const geracaoExcluir = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const geracao = await ArteGeracao.findOne({
      where: { id: Number(req.params.id), ...whereEscopo(user, req) },
      include: [{ model: ArteGeracaoArquivo, as: 'arquivos' }],
    });
    if (!geracao) return res.status(404).json({ ok: false });
    for (const arq of ((geracao as any).arquivos || [])) {
      try {
        const abs = path.join(process.cwd(), 'public', String(arq.url).replace(/^\//, ''));
        if (String(arq.url).includes('/uploads/') && fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch { /* ignora */ }
    }
    await ArteGeracaoArquivo.destroy({ where: { geracao_id: geracao.id } });
    await geracao.destroy();
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro artes/geracaoExcluir:', error);
    res.status(500).json({ ok: false });
  }
};

// ── Assistência textual por IA (restrita ao texto) ─────────────────────────────

async function gerarComFallback(prompt: string, sistema: string, modelo: string): Promise<string> {
  try {
    return await ollamaGenerate(prompt, sistema, modelo);
  } catch (e) {
    const padrao = process.env.OLLAMA_MODEL || 'gemma3:1b';
    if (!modelo.includes('cloud') || modelo === padrao) throw e;
    return await ollamaGenerate(prompt, sistema, padrao);
  }
}

function limparMarkdown(s: string): string {
  return String(s || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();
}

export const iaRevisar = async (req: Request, res: Response) => {
  try {
    const texto = String(req.body.texto || '').trim();
    const fatos = String(req.body.fatos || '').trim();
    if (!texto) return res.status(400).json({ error: 'Não há texto para revisar.' });
    const { systemPrompt, modelo } = await getIaConfig();
    const instrucao = `${systemPrompt}\n\nVocê revisa textos de comunicação institucional. Corrija ortografia, gramática, clareza e fluidez, mantendo o sentido e o tamanho aproximados. NUNCA altere datas, horários, endereços, telefones, nomes, valores, prazos ou números — preserve-os exatamente. Responda apenas com o texto revisado em texto simples, sem markdown nem comentários.`;
    const prompt = `Texto original:\n"""${texto}"""${fatos ? `\n\nInformações factuais que NÃO podem ser alteradas: ${fatos}` : ''}`;
    const revisado = limparMarkdown(await gerarComFallback(prompt, instrucao, modelo));
    res.json({ texto: revisado, original: texto });
  } catch (error) {
    console.error('Erro artes/ia-revisar:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento. Você pode seguir sem a revisão.' });
  }
};

function extrairJsonCampos(resposta: string, campos: Campo[], base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...base };
  let obj: any = null;
  const m = String(resposta || '').match(/\{[\s\S]*\}/);
  if (m) { try { obj = JSON.parse(m[0]); } catch { obj = null; } }
  if (!obj || typeof obj !== 'object') {
    obj = {};
    for (const linha of String(resposta || '').split('\n')) {
      const mm = linha.match(/^\s*"?([\w.]+)"?\s*[:\-]\s*(.+)$/);
      if (mm) obj[mm[1]] = String(mm[2]).replace(/^["']|["']$/g, '').trim();
    }
  }
  for (const c of campos) {
    let v = obj[c.chave];
    if (v === undefined || v === null) continue;
    v = String(v).trim();
    if (c.maxCaracteres && v.length > c.maxCaracteres) v = v.slice(0, c.maxCaracteres).trim();
    out[c.chave] = v;
  }
  return out;
}

/**
 * Modo IA: lê a solicitação, corrige o texto e preenche os campos do banner
 * respeitando os limites de cada campo.
 */
export const iaPreencher = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const templateId = Number(req.body.template_id);
    const solicitacaoId = Number(req.body.solicitacao_id) || 0;
    const base = parseJson<Record<string, string>>(req.body.dados, {});
    const tpl = await carregarTemplate(templateId, user, req);
    if (!tpl) return res.status(404).json({ ok: false, error: 'Modelo não encontrado' });

    const campos = camposEfetivos(parseJson<Campo[]>(tpl.campos, []), tpl.variantes || []);

    let origem = '';
    if (solicitacaoId) {
      const sol = await Solicitacao.findOne({ where: { id: solicitacaoId, ...whereEscopo(user, req) }, include: [{ model: Secretaria, as: 'secretaria' }] });
      if (sol) {
        const desc = String((sol as any).descricao || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        origem = `Título da solicitação: ${sol.titulo}\nDescrição: ${desc}\nSecretaria: ${(sol as any).secretaria?.nome || ''}\nPrazo: ${(sol as any).prazo || ''}`;
      }
    }
    if (!origem) origem = `Dados informados:\n${JSON.stringify(base)}`;

    const listaCampos = campos.map((c) => `- "${c.chave}" (${c.rotulo}; ${c.tipo}${c.maxCaracteres ? `; máximo ${c.maxCaracteres} caracteres` : ''}${c.obrigatorio ? '; obrigatório' : ''})`).join('\n');

    const { systemPrompt, modelo } = await getIaConfig();
    const instrucao = `${systemPrompt}\n\nVocê redige textos de comunicação institucional em português do Brasil. Corrija ortografia, gramática, clareza e dicção. Ajuste cada texto para caber no limite de caracteres informado. NUNCA invente datas, horários, endereços, nomes, valores ou números: use apenas o que foi fornecido e preserve-os exatamente. Se faltar informação para um campo, deixe-o como string vazia "". Não use markdown.`;
    const prompt = `Solicitação:\n${origem}\n\nCampos do banner (preencha todos):\n${listaCampos}\n\nResponda APENAS com um objeto JSON válido, sem texto antes ou depois e sem markdown, no formato:\n{"chave":"valor", ...}`;

    const resposta = await gerarComFallback(prompt, instrucao, modelo);
    const dados = extrairJsonCampos(resposta, campos, base);
    res.json({ ok: true, dados });
  } catch (error) {
    console.error('Erro artes/ia-preencher:', error);
    res.status(503).json({ ok: false, error: 'Assistente de IA indisponível no momento. Você pode preencher manualmente.' });
  }
};

export const iaCarrossel = async (req: Request, res: Response) => {
  try {
    const texto = String(req.body.texto || '').trim();
    const tituloBase = String(req.body.titulo || '').trim();
    const paginas = Math.max(2, Math.min(10, Number(req.body.paginas) || 3));
    if (!texto) return res.status(400).json({ error: 'Informe o conteúdo para distribuir.' });
    const { systemPrompt, modelo } = await getIaConfig();
    const instrucao = `${systemPrompt}\n\nVocê organiza conteúdo para carrosséis de redes sociais. Distribua o texto em páginas respeitando títulos, subtítulos e blocos. Nunca invente fatos, datas ou números: use apenas o conteúdo fornecido. Não use markdown.`;
    const prompt = `Título geral: "${tituloBase}"\nConteúdo:\n"""${texto}"""\n\nDivida em exatamente ${paginas} páginas. Responda apenas com as páginas, uma após a outra, separadas por uma linha contendo apenas "===". Cada página neste formato exato:\nTítulo: <título curto>\nTexto: <conteúdo da página>`;
    const resposta = limparMarkdown(await gerarComFallback(prompt, instrucao, modelo));
    const paginasArr = dividirEmPaginas(resposta, paginas);
    if (paginasArr.length === 0) paginasArr.push({ titulo: tituloBase, texto });
    res.json({ paginas: paginasArr.slice(0, paginas) });
  } catch (error) {
    console.error('Erro artes/ia-carrossel:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível. Você pode distribuir o conteúdo manualmente.' });
  }
};

/**
 * Divide a resposta da IA em páginas, tolerando variações de formato
 * (delimitador "===", marcadores "Página n", ou múltiplos blocos "Título:").
 */
function dividirEmPaginas(resposta: string, paginas: number): { titulo: string; texto: string }[] {
  const bruto = String(resposta || '').replace(/\r/g, '').trim();
  if (!bruto) return [];
  let blocos: string[] = [];

  if (/^\s*={3,}\s*$/m.test(bruto)) {
    blocos = bruto.split(/^\s*={3,}\s*$/m).map((b) => b.trim()).filter(Boolean);
  }
  if (blocos.length < 2 && /p[áa]gina\s*\d+/i.test(bruto)) {
    blocos = bruto.split(/(?:^|\n)\s*(?:#{1,6}\s*|\*{0,2})p[áa]gina\s*\d+[^\n]*/gi).map((b) => b.trim()).filter(Boolean);
  }
  if (blocos.length < 2) {
    const partes = bruto.split(/(?=^\s*(?:#{1,6}\s*|\*{0,2})t[íi]tulo\s*[:\-])/gim).map((b) => b.trim()).filter(Boolean);
    if (partes.length >= 2) blocos = partes;
  }
  if (blocos.length === 0) blocos = [bruto];

  const paginasArr = blocos.map((b) => {
    const mTitulo = b.match(/t[íi]tulo\s*[:\-]\s*(.+)/i);
    const mTexto = b.match(/texto\s*[:\-]\s*([\s\S]+)/i);
    const titulo = (mTitulo ? mTitulo[1] : '').trim().replace(/^["']|["']$/g, '').slice(0, 120);
    let corpo = mTexto ? mTexto[1] : b;
    corpo = corpo.replace(/^t[íi]tulo\s*[:\-].*$/im, '')
      .replace(/^(?:#{1,6}\s*|\*{0,2})p[áa]gina\s*\d+[^\n]*$/gim, '')
      .trim();
    return { titulo, texto: corpo };
  }).filter((p) => p.texto || p.titulo);

  return paginasArr.length ? paginasArr : [{ titulo: '', texto: bruto }];
}
