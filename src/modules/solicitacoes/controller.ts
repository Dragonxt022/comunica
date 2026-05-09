import { Request, Response } from 'express';
import SolicitacaoRepository from './repository.ts';
import { Secretaria, SolicitacaoComentario, User } from '../../database/models/index.ts';
import { sseBroker } from '../../lib/sse.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const { q, status: filtroStatus, prioridade: filtroPrioridade } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = 20;

    const { Op } = await import('sequelize');

    let where: any = {};
    if (user.role === 'secretaria') {
      where.secretaria_id = user.secretaria_id;
    }
    if (q) where.titulo = { [Op.like]: `%${q}%` };
    if (filtroStatus) where.status = filtroStatus;
    if (filtroPrioridade) where.prioridade = filtroPrioridade;

    const { count, rows: solicitacoes } = await SolicitacaoRepository.findAndCountAll(where, perPage, (page - 1) * perPage);

    // summary counts (all, ignoring pagination)
    const allSolics = await SolicitacaoRepository.findAll(user.role === 'secretaria' ? { secretaria_id: user.secretaria_id } : {});
    const counts: Record<string, number> = {};
    ['pendente','aprovado','produção','concluído','cancelado','finalizado'].forEach(s => {
      counts[s] = allSolics.filter((x: any) => x.status === s).length;
    });

    res.render('solicitacoes/index', {
      title: 'Solicitações',
      solicitacoes,
      counts,
      q: q || '',
      filtroStatus: filtroStatus || '',
      filtroPrioridade: filtroPrioridade || '',
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
      total: count,
    });
  } catch (error) {
    console.error('Error listing solicitacoes:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true } });
    res.render('solicitacoes/create', { title: 'Nova Solicitação', secretarias });
  } catch (error) {
    console.error('Error creating solicitacao view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const show = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const sol = await SolicitacaoRepository.findById(Number(req.params.id));
    if (!sol) return res.status(404).redirect('/solicitacoes');

    if (user.role === 'secretaria' && sol.secretaria_id !== user.secretaria_id) {
      return res.status(403).redirect('/solicitacoes');
    }

    const comentarios = await SolicitacaoComentario.findAll({
      where: { solicitacao_id: sol.id },
      include: [{ model: User, as: 'autor' }],
      order: [['createdAt', 'ASC']],
    });

    res.render('solicitacoes/show', { title: `Solicitação #${sol.id}`, sol, comentarios });
  } catch (error) {
    console.error('Error showing solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (user.role === 'secretaria') return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const allowed = ['pendente', 'aprovado', 'produção', 'concluído', 'finalizado', 'cancelado'];
    const { status } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Status inválido' });

    const id = Number(req.params.id);
    await SolicitacaoRepository.update(id, { status });
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'evento',
      texto: `Status alterado para "${status}"`,
    });

    sseBroker.broadcast({
      type: 'solicitacao_status',
      id,
      status,
      updatedBy: user.nome,
      updatedById: user.id,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating solicitacao status:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, prioridade, tipo_midia, secretaria_id } = req.body;
    const user = (req as any).session.user;

    const sol = await SolicitacaoRepository.create({
      titulo,
      descricao,
      prioridade,
      tipo_midia,
      secretaria_id: user.role === 'admin' || user.role === 'secom' ? secretaria_id : user.secretaria_id,
      criado_por: user.id,
      status: 'pendente',
    });

    await SolicitacaoComentario.create({
      solicitacao_id: sol.id,
      autor_id: user.id,
      tipo: 'evento',
      texto: 'Chamado aberto.',
    });

    res.redirect('/solicitacoes');
  } catch (error) {
    console.error('Error storing solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const addComentario = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const id = Number(req.params.id);
    const { texto } = req.body;
    const file = (req as any).file;

    if (!texto?.trim() && !file) {
      return res.redirect(`/solicitacoes/${id}#feed`);
    }

    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: file ? 'anexo' : 'comentario',
      texto: texto?.trim() || null,
      arquivo_url: file ? `/uploads/solicitacoes/${file.filename}` : null,
      arquivo_nome: file ? file.originalname : null,
    });

    sseBroker.broadcast({
      type: 'solicitacao_comentario',
      id,
      autor: user.nome,
      updatedById: user.id,
    });

    return res.redirect(`/solicitacoes/${id}#feed`);
  } catch (error) {
    console.error('Error adding comentario:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const aprovar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const id = Number(req.params.id);
    const sol = await SolicitacaoRepository.findById(id);
    if (!sol) return res.redirect('/solicitacoes');

    if (user.role === 'secretaria' && sol.secretaria_id !== user.secretaria_id) {
      return res.redirect('/solicitacoes');
    }

    await SolicitacaoRepository.update(id, { status: 'finalizado' });
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'aprovacao',
      texto: 'Material aprovado. Solicitação encerrada com sucesso.',
    });

    sseBroker.broadcast({
      type: 'solicitacao_status',
      id,
      status: 'finalizado',
      updatedBy: user.nome,
      updatedById: user.id,
    });

    return res.redirect(`/solicitacoes/${id}`);
  } catch (error) {
    console.error('Error aproving solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const pedirRevisao = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const id = Number(req.params.id);
    const { texto } = req.body;
    const sol = await SolicitacaoRepository.findById(id);
    if (!sol) return res.redirect('/solicitacoes');

    if (user.role === 'secretaria' && sol.secretaria_id !== user.secretaria_id) {
      return res.redirect('/solicitacoes');
    }

    await SolicitacaoRepository.update(id, { status: 'produção' });
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'revisao',
      texto: texto?.trim() || 'Revisão solicitada.',
    });

    sseBroker.broadcast({
      type: 'solicitacao_status',
      id,
      status: 'produção',
      updatedBy: user.nome,
      updatedById: user.id,
    });

    return res.redirect(`/solicitacoes/${id}#feed`);
  } catch (error) {
    console.error('Error requesting revisao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const sol = await SolicitacaoRepository.findById(Number(req.params.id));
    if (!sol) return res.redirect('/solicitacoes');
    if (user.role === 'secretaria' && sol.secretaria_id !== user.secretaria_id) {
      return res.redirect('/solicitacoes');
    }
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('solicitacoes/edit', { title: `Editar Solicitação #${sol.id}`, sol, secretarias });
  } catch (error) {
    console.error('Error editing solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateSolicitacao = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const { titulo, descricao, prioridade, tipo_midia, secretaria_id } = req.body;
    const updateData: any = { titulo, descricao, prioridade, tipo_midia };
    if (user.role === 'admin' || user.role === 'secom') {
      updateData.secretaria_id = secretaria_id;
    }
    await SolicitacaoRepository.update(Number(req.params.id), updateData);
    res.redirect('/solicitacoes/' + req.params.id);
  } catch (error) {
    console.error('Error updating solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (user.role === 'secretaria') return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const { link_publicacao } = req.body;
    const file = (req as any).file;

    const updates: any = {};
    if (file) {
      updates.arte_final_url = `/uploads/solicitacoes/${file.filename}`;
      updates.arte_final_nome = file.originalname;
    }
    if (link_publicacao !== undefined) {
      updates.link_publicacao = link_publicacao.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ ok: true });
    }

    await SolicitacaoRepository.update(id, updates);
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'evento',
      texto: 'Material atualizado.',
    });

    sseBroker.broadcast({ type: 'solicitacao_comentario', id, autor: user.nome, updatedById: user.id });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating material:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const concluir = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (user.role === 'secretaria') return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const { link_publicacao } = req.body;
    const file = (req as any).file;

    const updates: any = { status: 'concluído' };
    if (file) {
      updates.arte_final_url = `/uploads/solicitacoes/${file.filename}`;
      updates.arte_final_nome = file.originalname;
    }
    if (link_publicacao?.trim()) {
      updates.link_publicacao = link_publicacao.trim();
    }

    await SolicitacaoRepository.update(id, updates);
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'evento',
      texto: `Status alterado para "concluído"`,
    });

    if (updates.arte_final_url || updates.link_publicacao) {
      await SolicitacaoComentario.create({
        solicitacao_id: id,
        autor_id: user.id,
        tipo: 'conclusao',
        texto: updates.link_publicacao || null,
        arquivo_url: updates.arte_final_url || null,
        arquivo_nome: updates.arte_final_nome || null,
      });
    }

    sseBroker.broadcast({
      type: 'solicitacao_status',
      id,
      status: 'concluído',
      updatedBy: user.nome,
      updatedById: user.id,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error concluding solicitacao:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};
