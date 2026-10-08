import { Request, Response } from 'express';
import fs from 'fs';
import * as Repo from './repository.ts';
import { municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';
import { getIaConfig } from '../ia/controller.ts';
import { escolherModeloVisao, analisarImagem, mergeDocumentos } from '../../lib/importar-documento.ts';
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
    const files = ((req as any).files || []) as any[];
    if (!files.length) return res.status(400).json({ ok: false, error: 'Envie ao menos uma imagem do documento.' });

    const { modelo: perfilModelo, systemPrompt } = await getIaConfig();
    const modelo = await escolherModeloVisao(perfilModelo);

    const resultados = [];
    for (const file of files) {
      const base64 = fs.readFileSync(file.path).toString('base64');
      resultados.push(await analisarImagem(base64, modelo, systemPrompt));
    }

    const dados = mergeDocumentos(resultados);
    return res.json({ ok: true, modelo, dados });
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
