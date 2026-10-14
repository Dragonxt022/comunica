import { Request, Response } from 'express';
import fs from 'fs';
import * as Repo from './repository.ts';
import { municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';
import { getIaConfig } from '../ia/controller.ts';
import { escolherModeloVisao, analisarImagem, analisarTexto, extrairTextoPdf, mergeDocumentos } from '../../lib/importar-documento.ts';
import type { DocumentoExtraido } from '../../lib/importar-documento.ts';
import AcaoPlanejamento from '../../database/models/AcaoPlanejamento.ts';
import IndicadorMeta from '../../database/models/IndicadorMeta.ts';
import Evento from '../../database/models/Evento.ts';

function podeEditarPlano(user: any, plano: any): boolean {
  if (!plano) return false;
  if (user.role !== 'super_admin' && plano.municipio_id && plano.municipio_id !== user.municipio_id) return false;
  if (user.role === 'secretaria' && plano.secretaria_id !== user.secretaria_id) return false;
  return true;
}

export const importarView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where: any = municipioWhere(user, {}, getActiveMid(req));
    if (user.role === 'secretaria') where.secretaria_id = user.secretaria_id;
    const planos = await Repo.findAllPlanos(where);
    const presetPlanoId = Number(req.query.plano_id) || null;
    res.render('planejamento/importar', { title: 'Importar documento (IA)', planos, presetPlanoId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const analisar = async (req: Request, res: Response) => {
  try {
    const files = ((req as any).files || {}) as Record<string, any[]>;
    const imagens = files.imagens || [];
    const pdfs = files.pdfs || [];
    const textoColado = String(req.body?.texto || '').trim();

    if (!imagens.length && !pdfs.length && !textoColado) {
      return res.status(400).json({ ok: false, error: 'Envie imagens, um PDF ou cole o texto do documento.' });
    }

    const { modelo: perfilModelo, systemPrompt } = await getIaConfig();
    const resultados: DocumentoExtraido[] = [];
    const avisos: string[] = [];
    let modeloVisao = '';

    // Imagens/fotos são analisadas por um modelo de visão.
    if (imagens.length) {
      modeloVisao = await escolherModeloVisao(perfilModelo);
      for (const file of imagens) {
        const base64 = fs.readFileSync(file.path).toString('base64');
        resultados.push(await analisarImagem(base64, modeloVisao, systemPrompt));
      }
    }

    // Texto colado pelo usuário é analisado como texto.
    if (textoColado) {
      resultados.push(await analisarTexto(textoColado, perfilModelo, systemPrompt));
    }

    // PDFs: extrai a camada de texto e analisa como texto.
    for (const file of pdfs) {
      let textoPdf = '';
      try {
        textoPdf = await extrairTextoPdf(fs.readFileSync(file.path));
      } catch (e) {
        console.error('Erro ao extrair texto do PDF:', e);
      }
      if (!textoPdf) {
        avisos.push(`O PDF "${file.originalname}" parece ser digitalizado (sem texto selecionável). Envie imagens das páginas ou cole o texto.`);
        continue;
      }
      resultados.push(await analisarTexto(textoPdf, perfilModelo, systemPrompt));
    }

    const dados = mergeDocumentos(resultados);
    const total = dados.indicadores.length + dados.acoes.length + dados.eventos.length;
    if (total === 0) {
      return res.status(422).json({
        ok: false,
        error: avisos[0] || 'Nenhuma informação estruturada foi identificada no documento. Tente imagens mais nítidas ou cole o texto.',
      });
    }

    return res.json({ ok: true, modelo: modeloVisao || perfilModelo, dados, avisos });
  } catch (err: any) {
    console.error('Erro importar/analisar:', err);
    return res.status(503).json({ ok: false, error: err?.message || 'Não foi possível analisar o documento. O assistente de IA pode estar indisponível.' });
  }
};

export const confirmar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const planoId = Number(req.body.plano_id);
    const plano: any = await Repo.findPlanoById(planoId);
    if (!plano) return res.status(404).json({ ok: false, error: 'Plano não encontrado.' });
    if (!podeEditarPlano(user, plano)) return res.status(403).json({ ok: false, error: 'Sem permissão para este plano.' });

    const indicadores = Array.isArray(req.body.indicadores) ? req.body.indicadores : [];
    const acoes = Array.isArray(req.body.acoes) ? req.body.acoes : [];
    const eventos = Array.isArray(req.body.eventos) ? req.body.eventos : [];

    const criados = { indicadores: 0, acoes: 0, eventos: 0 };

    for (const it of indicadores) {
      if (!it?.indicador) continue;
      await IndicadorMeta.create({
        indicador: String(it.indicador).slice(0, 255),
        descricao: it.descricao || null,
        valor_meta: Number(it.valor_meta) || 0,
        valor_atual: Number(it.valor_atual) || 0,
        unidade: it.unidade || 'unidades',
        plano_id: planoId,
      } as any);
      criados.indicadores++;
    }

    for (const it of acoes) {
      if (!it?.titulo) continue;
      await AcaoPlanejamento.create({
        titulo: String(it.titulo).slice(0, 255),
        descricao: it.descricao || null,
        objetivo: it.objetivo || null,
        responsavel_nome: it.responsavel_nome || null,
        prazo: it.prazo || null,
        prioridade: ['baixa', 'media', 'alta'].includes(it.prioridade) ? it.prioridade : 'media',
        status: 'nao_iniciado',
        plano_id: planoId,
      } as any);
      criados.acoes++;
    }

    for (const it of eventos) {
      if (!it?.titulo) continue;
      const inicio = it.data_inicio ? new Date(it.data_inicio) : new Date();
      const fim = it.data_fim ? new Date(it.data_fim) : inicio;
      await Evento.create({
        titulo: String(it.titulo).slice(0, 255),
        descricao: it.descricao || '',
        local: it.local || '',
        data_inicio: isNaN(inicio.getTime()) ? new Date() : inicio,
        data_fim: isNaN(fim.getTime()) ? new Date() : fim,
        tipo: it.tipo || 'Outros',
        status: 'em_planejamento',
        secretaria_id: plano.secretaria_id,
        municipio_id: plano.municipio_id,
        plano_id: planoId,
        criado_por: user.id,
      } as any);
      criados.eventos++;
    }

    return res.json({ ok: true, criados });
  } catch (err: any) {
    console.error('Erro importar/confirmar:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Falha ao cadastrar os itens.' });
  }
};
