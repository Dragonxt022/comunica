import { Request, Response } from 'express';
import EventoRepository from './repository.ts';
import { Secretaria, Evento, User, EventoResponsavel } from '../../database/models/index.ts';
import { sseBroker } from '../../lib/sse.ts';
import { notificar, notificarRole } from '../../lib/notificacao.ts';

function parseIds(raw: any): number[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(Number).filter(Boolean);
}

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const where: any = {};
    if (user?.role === 'secretaria' && user?.secretaria_id) {
      where.secretaria_id = user.secretaria_id;
    }
    const eventos = await EventoRepository.findAll(where);
    res.render('eventos/index', { title: 'Calendário Institucional', eventos });
  } catch (error) {
    console.error('Error listing eventos:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true } });
    const users = await User.findAll({ where: { ativo: true }, include: [{ model: Secretaria, as: 'secretaria' }] });
    const prefillDate = (req.query.data as string) || '';
    res.render('eventos/create', { title: 'Novo Evento', secretarias, users, prefillDate });
  } catch (error) {
    console.error('Error creating evento view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const evento = await EventoRepository.findById(Number(req.params.id));
    if (!evento) return res.redirect('/eventos');
    const secretarias = await Secretaria.findAll({ where: { ativo: true } });
    const users = await User.findAll({ where: { ativo: true }, include: [{ model: Secretaria, as: 'secretaria' }] });
    res.render('eventos/edit', { title: 'Editar Evento', evento, secretarias, users });
  } catch (error) {
    console.error('Error editing evento view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { titulo, descricao, local, data_inicio, data_fim, tipo, secretaria_id } = req.body;

    const eventoAntes = await EventoRepository.findById(id);
    await EventoRepository.update(id, { titulo, descricao, local, data_inicio, data_fim, tipo, secretaria_id });

    const ids = parseIds(req.body.responsaveis);
    await EventoResponsavel.destroy({ where: { evento_id: id } });
    if (ids.length) {
      await EventoResponsavel.bulkCreate(ids.map(uid => ({ evento_id: id, user_id: uid })));
    }

    // Detecta o que mudou para montar corpo útil da notificação
    const mudancas: string[] = [];
    if (eventoAntes) {
      const fmtDt = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      if (eventoAntes.titulo !== titulo) mudancas.push(`título alterado`);
      if (eventoAntes.local !== local) mudancas.push(`local: ${local || 'removido'}`);
      const dAntes = fmtDt(eventoAntes.data_inicio);
      const dDepois = fmtDt(data_inicio);
      if (dAntes !== dDepois) mudancas.push(`data: ${dDepois}`);
    }
    const corpo = mudancas.length > 0 ? mudancas.join(' · ') : 'Informações atualizadas.';

    notificarRole(['admin', 'secom'], {
      titulo: '✏️ Evento atualizado',
      corpo: `${titulo} — ${corpo}`,
      url: `/eventos`,
      tipo: 'evento_atualizado',
    }).catch(() => {});

    res.redirect('/eventos');
  } catch (error) {
    console.error('Error updating evento:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status || typeof status !== 'string' || !/^[\w_]+$/.test(status)) {
      return res.status(400).json({ ok: false, error: 'Status inválido' });
    }

    const evento = await EventoRepository.findById(id);
    await Evento.update({ status }, { where: { id } });

    sseBroker.broadcast({
      type: 'evento_status',
      id,
      status,
      updatedBy: user?.nome || 'Sistema',
      updatedById: user?.id || 0,
    });

    if (evento) {
      if (status === 'publicado') {
        // Notifica a secretaria responsável pelo evento
        if (evento.criado_por) {
          notificar(evento.criado_por, {
            titulo: '✅ Evento publicado',
            corpo: `"${evento.titulo}" foi publicado na agenda.`,
            url: `/eventos`,
            tipo: 'evento_publicado',
          }).catch(() => {});
        }
      } else if (status === 'cancelado') {
        // Notifica admin + secom e também a secretaria criadora
        notificarRole(['admin', 'secom'], {
          titulo: '❌ Evento cancelado',
          corpo: `"${evento.titulo}" foi cancelado.`,
          url: `/eventos`,
          tipo: 'evento_cancelado',
        }).catch(() => {});
        if (evento.criado_por) {
          notificar(evento.criado_por, {
            titulo: '❌ Evento cancelado',
            corpo: `"${evento.titulo}" foi cancelado.`,
            url: `/eventos`,
            tipo: 'evento_cancelado',
          }).catch(() => {});
        }
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating evento status:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const arquivar = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await Evento.update({ arquivado: true } as any, { where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error archiving evento:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const historico = async (req: Request, res: Response) => {
  try {
    const eventos = await Evento.findAll({
      where: { arquivado: true } as any,
      include: [{ model: Secretaria, as: 'secretaria' }],
      order: [['data_inicio', 'DESC']],
    });
    res.render('eventos/historico', { title: 'Histórico de Eventos', eventos });
  } catch (error) {
    console.error('Error listing historico:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, local, data_inicio, data_fim, tipo, secretaria_id } = req.body;
    const user = (req as any).session.user;

    const evento = await EventoRepository.create({
      titulo,
      descricao,
      local,
      data_inicio,
      data_fim,
      tipo,
      secretaria_id: user.role === 'admin' || user.role === 'secom' ? secretaria_id : user.secretaria_id,
      criado_por: user.id,
      status: 'em_planejamento',
    });

    const ids = parseIds(req.body.responsaveis);
    if (ids.length) {
      await EventoResponsavel.bulkCreate(ids.map(uid => ({ evento_id: (evento as any).id, user_id: uid })));
    }

    const dataFmt = new Date(data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    notificarRole(['admin', 'secom'], {
      titulo: '📅 Novo evento cadastrado',
      corpo: `${titulo} — ${dataFmt}${local ? ' · ' + local : ''}`,
      url: `/eventos`,
      tipo: 'evento_novo',
    }).catch(() => {});

    res.redirect('/eventos');
  } catch (error) {
    console.error('Error storing evento:', error);
    res.status(500).send('Internal Server Error');
  }
};
