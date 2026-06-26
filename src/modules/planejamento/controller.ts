import { Request, Response } from 'express';
import * as Repo from './repository.ts';
import { Secretaria, Evento } from '../../database/models/index.ts';
import AcaoPlanejamento from '../../database/models/AcaoPlanejamento.ts';
import { municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';

// ─── Planos ───────────────────────────────────────────────────────────────────

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where: any = municipioWhere(user, {}, getActiveMid(req));
    if (user.role === 'secretaria') where.secretaria_id = user.secretaria_id;
    const planos = await Repo.findAllPlanos(where);
    res.render('planejamento/index', { title: 'Planejamento', planos });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const createView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') secWhere.municipio_id = user.municipio_id;
    const secretarias = await Secretaria.findAll({ where: secWhere });
    res.render('planejamento/create', { title: 'Novo Plano de Ação', secretarias });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const { titulo, descricao, periodo_inicio, periodo_fim, secretaria_id } = req.body;
    const secId = ['admin', 'secom', 'super_admin'].includes(user.role) ? secretaria_id : user.secretaria_id;
    const plano = await Repo.createPlano({ titulo, descricao, periodo_inicio, periodo_fim, secretaria_id: secId, municipio_id: user.municipio_id, criado_por: user.id });
    res.redirect(`/planejamento/${(plano as any).id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const show = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const plano = await Repo.findPlanoById(Number(req.params.id));
    if (!plano) return res.redirect('/planejamento');
    if (user.role !== 'super_admin' && (plano as any).municipio_id && (plano as any).municipio_id !== user.municipio_id) {
      return res.redirect('/planejamento');
    }
    if (user.role === 'secretaria' && (plano as any).secretaria_id !== user.secretaria_id) {
      return res.redirect('/planejamento');
    }

    // Para cada ação com evento_id, buscar dados do evento
    const acoes = (plano as any).acoes || [];
    const eventoIds = acoes.filter((a: any) => a.evento_id).map((a: any) => a.evento_id);
    const eventosMap: Record<number, any> = {};
    if (eventoIds.length) {
      const evs = await Evento.findAll({ where: { id: eventoIds }, attributes: ['id', 'titulo', 'status', 'data_inicio'] });
      evs.forEach((e: any) => { eventosMap[e.id] = e; });
    }

    res.render('planejamento/show', { title: plano.titulo, plano, eventosMap });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const plano = await Repo.findPlanoById(Number(req.params.id));
    if (!plano) return res.redirect('/planejamento');
    if (user.role !== 'super_admin' && (plano as any).municipio_id && (plano as any).municipio_id !== user.municipio_id) {
      return res.redirect('/planejamento');
    }
    if (user.role === 'secretaria' && (plano as any).secretaria_id !== user.secretaria_id) {
      return res.redirect('/planejamento');
    }
    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') secWhere.municipio_id = user.municipio_id;
    const secretarias = await Secretaria.findAll({ where: secWhere });
    res.render('planejamento/edit', { title: 'Editar Plano', plano, secretarias });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { titulo, descricao, periodo_inicio, periodo_fim, secretaria_id, status } = req.body;
    const user = (req as any).session.user;
    const updateData: any = { titulo, descricao, periodo_inicio, periodo_fim, status };
    if (['admin', 'secom', 'super_admin'].includes(user.role)) updateData.secretaria_id = secretaria_id;
    await Repo.updatePlano(id, updateData);
    res.redirect(`/planejamento/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const destroy = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!['admin', 'secom', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }
    await Repo.destroyPlano(Number(req.params.id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
};

// ─── Ações ────────────────────────────────────────────────────────────────────

export const storeAcao = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    const { titulo, descricao, objetivo, responsavel_nome, prazo, prioridade, status } = req.body;
    await Repo.createAcao({ titulo, descricao, objetivo, responsavel_nome, prazo: prazo || null, prioridade, status, plano_id });
    res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const updateAcao = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    const acao_id = Number(req.params.aId);
    const { titulo, descricao, objetivo, responsavel_nome, prazo, prioridade, status } = req.body;
    await Repo.updateAcao(acao_id, { titulo, descricao, objetivo, responsavel_nome, prazo: prazo || null, prioridade, status });
    res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const destroyAcao = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    await Repo.destroyAcao(Number(req.params.aId));
    return res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Erro interno');
  }
};

export const updateStatusAcao = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !/^[\w_]+$/.test(status)) {
      return res.status(400).json({ ok: false, error: 'Status inválido' });
    }
    await Repo.updateAcao(Number(req.params.aId), { status });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
};

export const desvincularEvento = async (req: Request, res: Response) => {
  try {
    await Repo.updateAcao(Number(req.params.aId), { evento_id: null });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
};

// ─── Impressão ───────────────────────────────────────────────────────────────

export const imprimir = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const plano = await Repo.findPlanoById(Number(req.params.id));
    if (!plano) return res.redirect('/planejamento');
    if (user.role !== 'super_admin' && (plano as any).municipio_id && (plano as any).municipio_id !== user.municipio_id) {
      return res.redirect('/planejamento');
    }
    if (user.role === 'secretaria' && (plano as any).secretaria_id !== user.secretaria_id) {
      return res.redirect('/planejamento');
    }
    const acoes = (plano as any).acoes || [];
    const eventoIds = acoes.filter((a: any) => a.evento_id).map((a: any) => a.evento_id);
    const eventosMap: Record<number, any> = {};
    if (eventoIds.length) {
      const { Evento } = await import('../../database/models/index.ts');
      const evs = await Evento.findAll({ where: { id: eventoIds }, attributes: ['id', 'titulo', 'status'] });
      evs.forEach((e: any) => { eventosMap[e.id] = e; });
    }
    res.render('planejamento/imprimir', { layout: false, title: plano.titulo, plano, eventosMap });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

// ─── Indicadores ─────────────────────────────────────────────────────────────

export const storeIndicador = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    const { indicador, descricao, valor_meta, valor_atual, unidade } = req.body;
    await Repo.createIndicador({ indicador, descricao, valor_meta: Number(valor_meta), valor_atual: Number(valor_atual || 0), unidade, plano_id });
    res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
};

export const updateIndicador = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    const iId = Number(req.params.iId);
    const { indicador, descricao, valor_meta, valor_atual, unidade } = req.body;
    await Repo.updateIndicador(iId, { indicador, descricao, valor_meta: Number(valor_meta), valor_atual: Number(valor_atual), unidade });
    return res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Erro interno');
  }
};

export const destroyIndicador = async (req: Request, res: Response) => {
  try {
    const plano_id = Number(req.params.id);
    await Repo.destroyIndicador(Number(req.params.iId));
    return res.redirect(`/planejamento/${plano_id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Erro interno');
  }
};
