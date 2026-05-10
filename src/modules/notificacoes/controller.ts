import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Notificacao from '../../database/models/Notificacao.ts';

const userId = (req: Request) => (req as any).session.user.id;

export const page = async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    const notificacoes = await Notificacao.findAll({
      where: { user_id: uid },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.render('notificacoes/index', { title: 'Notificações', notificacoes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};

export const latest = async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    const items = await Notificacao.findAll({
      where: { user_id: uid },
      order: [['createdAt', 'DESC']],
      limit: 8,
    });
    const unread = await Notificacao.count({ where: { user_id: uid, lida: false } });
    res.json({ ok: true, items, unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
};

export const unreadCount = async (req: Request, res: Response) => {
  try {
    const count = await Notificacao.count({ where: { user_id: userId(req), lida: false } });
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
};

export const marcarLida = async (req: Request, res: Response) => {
  try {
    await Notificacao.update(
      { lida: true },
      { where: { id: req.params.id, user_id: userId(req) } }
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};

export const marcarTodasLidas = async (req: Request, res: Response) => {
  try {
    await Notificacao.update({ lida: true }, { where: { user_id: userId(req), lida: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};

export const excluir = async (req: Request, res: Response) => {
  try {
    await Notificacao.destroy({ where: { id: req.params.id, user_id: userId(req) } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};

export const excluirTodas = async (req: Request, res: Response) => {
  try {
    await Notificacao.destroy({ where: { user_id: userId(req) } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};

export const excluirLidas = async (req: Request, res: Response) => {
  try {
    await Notificacao.destroy({ where: { user_id: userId(req), lida: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};
