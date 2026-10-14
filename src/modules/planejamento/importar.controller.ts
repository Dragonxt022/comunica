import { Request, Response } from 'express';
import fs from 'fs';
import * as Repo from './repository.ts';
import { municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';
import { getIaConfig } from '../ia/controller.ts';
import { escolherModeloVisao, analisarImagem, analisarTexto, extrairTextoPdf, mergeDocumentos } from '../../lib/importar-documento.ts';
import type { DocumentoExtraido } from '../../lib/importar-documento.ts';
import AcaoPlanejamento from '../../database/models/AcaoPlanejamento.ts';
import IndicadorMeta from '../../database/models/IndicadorMeta.ts';
import ImportacaoPlano from '../../database/models/ImportacaoPlano.ts';

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

    // Cada confirmação vira um "lote" de importação, permitindo desfazer depois.
    const lote = await ImportacaoPlano.create({
      plano_id: planoId,
      criado_por: user.id,
      resumo: null,
      total_indicadores: 0,
      total_acoes: 0,
    } as any);

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
        importacao_id: lote.id,
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
        importacao_id: lote.id,
      } as any);
      criados.acoes++;
    }

    // Eventos extraídos viram AÇÕES do plano: é a partir da ação que o usuário
    // decide criar o evento real no calendário ou abrir uma solicitação.
    for (const it of eventos) {
      if (!it?.titulo) continue;
      const dataEv = it.data_inicio ? String(it.data_inicio).slice(0, 10) : null;
      await AcaoPlanejamento.create({
        titulo: String(it.titulo).slice(0, 255),
        descricao: it.descricao || null,
        objetivo: null,
        responsavel_nome: null,
        prazo: dataEv || null,
        evento_local: it.local ? String(it.local).slice(0, 255) : null,
        prioridade: 'media',
        status: 'nao_iniciado',
        plano_id: planoId,
        importacao_id: lote.id,
      } as any);
      criados.eventos++;
    }

    await lote.update({ total_indicadores: criados.indicadores, total_acoes: criados.acoes + criados.eventos } as any);

    return res.json({ ok: true, criados, importacao_id: lote.id });
  } catch (err: any) {
    console.error('Erro importar/confirmar:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Falha ao cadastrar os itens.' });
  }
};

/** Desfaz a última importação de um plano, removendo os itens criados naquele lote. */
export const desfazer = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const planoId = Number(req.body.plano_id);
    const plano: any = await Repo.findPlanoById(planoId);
    if (!plano) return res.status(404).json({ ok: false, error: 'Plano não encontrado.' });
    if (!podeEditarPlano(user, plano)) return res.status(403).json({ ok: false, error: 'Sem permissão para este plano.' });

    const lote: any = await ImportacaoPlano.findOne({
      where: { plano_id: planoId },
      order: [['createdAt', 'DESC']],
    });
    if (!lote) return res.status(404).json({ ok: false, error: 'Não há importação para desfazer neste plano.' });

    const nInd = await IndicadorMeta.destroy({ where: { importacao_id: lote.id } });
    const nAcoes = await AcaoPlanejamento.destroy({ where: { importacao_id: lote.id } });
    await lote.destroy();

    return res.json({ ok: true, removidos: { indicadores: nInd, acoes: nAcoes } });
  } catch (err: any) {
    console.error('Erro importar/desfazer:', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível desfazer a importação.' });
  }
};
