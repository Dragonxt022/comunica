import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import SolicitacaoRepository from './repository.ts';
import { Secretaria, Solicitacao, SolicitacaoComentario, User, Evento, EventoResponsavel } from '../../database/models/index.ts';
import { sseBroker } from '../../lib/sse.ts';
import { notificar, notificarRole } from '../../lib/notificacao.ts';
import { secretariaWhere, municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';

function parseIds(raw: any): number[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(Number).filter(Boolean);
}

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const { q, status: filtroStatus, prioridade: filtroPrioridade, tipo: filtroTipo } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = 20;

    const { Op } = await import('sequelize');

    const mid = getActiveMid(req);
    let where: any = secretariaWhere(user, {}, mid);
    if (q) where.titulo = { [Op.like]: `%${q}%` };
    if (filtroStatus) where.status = filtroStatus;
    if (filtroPrioridade) where.prioridade = filtroPrioridade;
    if (filtroTipo) where.tipo_midia = filtroTipo;

    const { count, rows: solicitacoes } = await SolicitacaoRepository.findAndCountAll(where, perPage, (page - 1) * perPage);

    // summary counts (all, ignoring pagination)
    const allSolics = await SolicitacaoRepository.findAll(secretariaWhere(user, {}, mid));
    const counts: Record<string, number> = {};
    ['pendente','aprovado','produção','concluído','cancelado','finalizado'].forEach(s => {
      counts[s] = allSolics.filter((x: any) => x.status === s).length;
    });

    res.render('solicitacoes/index', {
      title: 'Solicitações',
      solicitacoes,
      kanbanSolics: allSolics,
      counts,
      q: q || '',
      filtroStatus: filtroStatus || '',
      filtroPrioridade: filtroPrioridade || '',
      filtroTipo: filtroTipo || '',
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
    const user = (req as any).session.user;
    const secWhere: any = { ativo: true };
    const usrWhere: any = { ativo: true };
    if (user.role !== 'super_admin') {
      secWhere.municipio_id = user.municipio_id;
      usrWhere.municipio_id = user.municipio_id;
    }
    const secretarias = await Secretaria.findAll({ where: secWhere });
    const users = await User.findAll({ where: usrWhere, include: [{ model: Secretaria, as: 'secretaria' }] });
    res.render('solicitacoes/create', { title: 'Nova Solicitação', secretarias, users });
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

    if (user.role !== 'super_admin' && sol.municipio_id && sol.municipio_id !== user.municipio_id) {
      return res.status(403).redirect('/solicitacoes');
    }
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
    if (!['admin', 'secom', 'super_admin'].includes(user.role)) return res.status(403).json({ ok: false, error: 'Sem permissão' });

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

    const notifMap: Record<string, { titulo: string; corpo: string; tipo: string }> = {
      'produção':   { titulo: 'Em produção',          corpo: `sua solicitação entrou em produção.`,              tipo: 'solicitacao_producao'  },
      'concluído':  { titulo: 'Pronto para revisão',  corpo: `o material está pronto — aguardando sua aprovação.`, tipo: 'solicitacao_concluida' },
      'finalizado': { titulo: 'Material finalizado',   corpo: `sua solicitação foi finalizada com sucesso.`,        tipo: 'solicitacao_aprovada'  },
      'cancelado':  { titulo: 'Solicitação cancelada', corpo: `sua solicitação foi cancelada pela SECOM.`,          tipo: 'solicitacao_cancelada' },
    };

    if (notifMap[status]) {
      const sol = await SolicitacaoRepository.findById(id);
      if (sol?.criado_por) {
        const n = notifMap[status];
        notificar(sol.criado_por, {
          titulo: n.titulo,
          corpo: `"${sol.titulo}" — ${n.corpo}`,
          url: `/solicitacoes/${id}`,
          tipo: n.tipo,
        }).catch(() => {});
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating solicitacao status:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, prioridade, secretaria_id, criar_evento, data_inicio, data_fim, local, tipo_evento } = req.body;
    const user = (req as any).session.user;

    let tipos: string[] = Array.isArray(req.body.tipos_midia)
      ? req.body.tipos_midia
      : req.body.tipos_midia ? [req.body.tipos_midia] : [];
    if (tipos.length === 0) tipos = ['Outros'];

    const secId = ['admin', 'secom', 'super_admin'].includes(user.role) ? secretaria_id : user.secretaria_id;

    const { prazo } = req.body;

    for (const tipo_midia of tipos) {
      const sol = await SolicitacaoRepository.create({
        titulo,
        descricao,
        prioridade,
        tipo_midia,
        prazo: prazo || null,
        secretaria_id: secId,
        criado_por: user.id,
        municipio_id: user.municipio_id,
        status: 'pendente',
      });

      await SolicitacaoComentario.create({
        solicitacao_id: sol.id,
        autor_id: user.id,
        tipo: 'evento',
        texto: 'Chamado aberto.',
      });

      notificarRole(['admin', 'secom'], {
        titulo: '📋 Nova solicitação',
        corpo: `${titulo} (${tipo_midia})`,
        url: `/solicitacoes/${sol.id}`,
        tipo: 'solicitacao_nova',
      }).catch(() => {});
    }

    if (criar_evento === '1' && data_inicio && data_fim) {
      const evento = await Evento.create({
        titulo,
        descricao,
        local: local?.trim() || 'A definir',
        data_inicio,
        data_fim,
        tipo: tipo_evento || 'Outros',
        secretaria_id: secId,
        criado_por: user.id,
        municipio_id: user.municipio_id,
        status: 'em_planejamento',
      } as any);

      const ids = parseIds(req.body['responsaveis[]'] || req.body.responsaveis);
      if (ids.length) {
        await EventoResponsavel.bulkCreate(ids.map((uid: number) => ({ evento_id: (evento as any).id, user_id: uid })));
      }

      const dataFmt = new Date(data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      notificarRole(['admin', 'secom'], {
        titulo: '📅 Novo evento cadastrado',
        corpo: `${titulo} — ${dataFmt}${local ? ' · ' + local : ''}`,
        url: `/eventos`,
        tipo: 'evento_novo',
      }).catch(() => {});
    }

    res.redirect('/solicitacoes');
  } catch (error) {
    console.error('Error storing solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const pendentesCount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!['admin', 'secom', 'super_admin'].includes(user?.role)) {
      return res.json({ count: 0 });
    }
    const where: any = { status: 'pendente' };
    if (user.role !== 'super_admin') where.municipio_id = user.municipio_id;
    const count = await Solicitacao.count({ where });
    return res.json({ count });
  } catch {
    return res.json({ count: 0 });
  }
};

export const destroy = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!['admin', 'secom', 'super_admin'].includes(user?.role)) {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }
    const id = Number(req.params.id);
    const sol = await SolicitacaoRepository.findById(id);
    if (!sol) return res.status(404).json({ ok: false, error: 'Não encontrado' });
    if (user.role !== 'super_admin' && sol.municipio_id && sol.municipio_id !== user.municipio_id) {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }
    if (sol.status !== 'cancelado') {
      return res.status(400).json({ ok: false, error: 'Só é possível excluir solicitações canceladas' });
    }
    // Remove arquivos anexados
    const deleteFile = (urlPath: string | null) => {
      if (!urlPath) return;
      try {
        const abs = path.join(process.cwd(), 'public', urlPath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    };
    deleteFile(sol.arte_final_url ?? null);
    await SolicitacaoComentario.destroy({ where: { solicitacao_id: id } });
    await Solicitacao.destroy({ where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting solicitacao:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
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

    const sol = await SolicitacaoRepository.findById(id);

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

    const tituloSol = sol?.titulo || `#${id}`;
    const corpoNotif = `${user.nome}: "${texto?.trim()?.substring(0, 60) || (file ? file.originalname : '')}"`;

    if (user.role === 'secretaria') {
      notificarRole(['admin', 'secom'], {
        titulo: '💬 Novo comentário',
        corpo: `${tituloSol} — ${corpoNotif}`,
        url: `/solicitacoes/${id}`,
        tipo: 'solicitacao_comentario',
      }).catch(() => {});
    } else if (sol?.criado_por && sol.criado_por !== user.id) {
      notificar(sol.criado_por, {
        titulo: '💬 Novo comentário',
        corpo: `${tituloSol} — ${corpoNotif}`,
        url: `/solicitacoes/${id}`,
        tipo: 'solicitacao_comentario',
      }).catch(() => {});
    }

    return res.redirect(`/solicitacoes/${id}#feed`);
  } catch (error) {
    console.error('Error adding comentario:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const getComentariosJson = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const comentarios = await SolicitacaoComentario.findAll({
      where: { solicitacao_id: id },
      include: [{ model: User, as: 'autor', attributes: ['id', 'nome', 'avatar'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json(comentarios.map(c => ({
      id: c.id,
      tipo: c.tipo,
      texto: c.texto,
      arquivo_url: c.arquivo_url,
      arquivo_nome: c.arquivo_nome,
      createdAt: c.createdAt,
      autor: c.autor ? { id: (c.autor as any).id, nome: (c.autor as any).nome, avatar: (c.autor as any).avatar } : null,
    })));
  } catch (error) {
    res.status(500).json([]);
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

    notificarRole(['admin', 'secom'], {
      titulo: '✅ Solicitação aprovada',
      corpo: `"${sol.titulo}" foi aprovada e encerrada.`,
      url: `/solicitacoes/${id}`,
      tipo: 'solicitacao_aprovada',
    }).catch(() => {});

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

    notificarRole(['admin', 'secom'], {
      titulo: '🔄 Revisão solicitada',
      corpo: `"${sol.titulo}" precisa de revisão.`,
      url: `/solicitacoes/${id}`,
      tipo: 'solicitacao_revisao',
    }).catch(() => {});

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
    const { titulo, descricao, prioridade, tipo_midia, secretaria_id, prazo } = req.body;
    const updateData: any = { titulo, descricao, prioridade, tipo_midia, prazo: prazo || null };
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
    if (!['admin', 'secom', 'super_admin'].includes(user.role)) return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const { link_publicacao, link_arquivo_matriz } = req.body;
    const file = (req as any).file;

    const updates: any = {};
    if (file) {
      updates.arte_final_url = `/uploads/solicitacoes/${file.filename}`;
      updates.arte_final_nome = file.originalname;
    }
    if (link_publicacao !== undefined) {
      updates.link_publicacao = link_publicacao.trim() || null;
    }
    if (link_arquivo_matriz !== undefined) {
      updates.link_arquivo_matriz = link_arquivo_matriz.trim() || null;
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
    if (!['admin', 'secom', 'super_admin'].includes(user.role)) return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const { link_publicacao, link_arquivo_matriz } = req.body;
    const file = (req as any).file;

    const updates: any = { status: 'concluído' };
    if (file) {
      updates.arte_final_url = `/uploads/solicitacoes/${file.filename}`;
      updates.arte_final_nome = file.originalname;
    }
    if (link_publicacao?.trim()) {
      updates.link_publicacao = link_publicacao.trim();
    }
    if (link_arquivo_matriz?.trim()) {
      updates.link_arquivo_matriz = link_arquivo_matriz.trim();
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

    const solParaPush = await SolicitacaoRepository.findById(id);
    if (solParaPush?.criado_por) {
      notificar(solParaPush.criado_por, {
        titulo: 'Material disponível para revisão',
        corpo: `"${solParaPush.titulo}" está pronto para revisão.`,
        url: `/solicitacoes/${id}`,
        tipo: 'solicitacao_concluida',
      }).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error concluding solicitacao:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};
