import { Request, Response } from 'express';
import EventoRepository from './repository.ts';
import { Secretaria, Evento, User, EventoResponsavel } from '../../database/models/index.ts';
import { sseBroker } from '../../lib/sse.ts';

function parseIds(raw: any): number[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(Number).filter(Boolean);
}

export const list = async (req: Request, res: Response) => {
  try {
    const eventos = await EventoRepository.findAll();
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
    await EventoRepository.update(id, { titulo, descricao, local, data_inicio, data_fim, tipo, secretaria_id });

    const ids = parseIds(req.body.responsaveis);
    await EventoResponsavel.destroy({ where: { evento_id: id } });
    if (ids.length) {
      await EventoResponsavel.bulkCreate(ids.map(uid => ({ evento_id: id, user_id: uid })));
    }

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

    await Evento.update({ status }, { where: { id } });

    sseBroker.broadcast({
      type: 'evento_status',
      id,
      status,
      updatedBy: user?.nome || 'Sistema',
      updatedById: user?.id || 0,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating evento status:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
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

    res.redirect('/eventos');
  } catch (error) {
    console.error('Error storing evento:', error);
    res.status(500).send('Internal Server Error');
  }
};
