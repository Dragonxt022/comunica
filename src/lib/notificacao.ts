import Notificacao from '../database/models/Notificacao.ts';
import { User } from '../database/models/index.ts';
import { sendToUser } from './push.ts';
import { sseBroker } from './sse.ts';

export interface NotifPayload {
  titulo: string;
  corpo?: string;
  url?: string;
  tipo?: string;
}

export async function notificar(userId: number, payload: NotifPayload): Promise<void> {
  try {
    await Notificacao.create({ user_id: userId, ...payload, lida: false });
    sseBroker.broadcast({ type: 'notificacao_nova', userId });
    sendToUser(userId, {
      title: payload.titulo,
      body:  payload.corpo || '',
      url:   payload.url,
      tag:   `${payload.tipo || 'notif'}-${userId}-${Date.now()}`,
    }).catch(() => {});
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
}

export async function notificarRole(role: string | string[], payload: NotifPayload): Promise<void> {
  const roles = Array.isArray(role) ? role : [role];
  const users = await User.findAll({ where: { role: roles, ativo: true }, attributes: ['id'] });
  await Promise.allSettled(users.map((u) => notificar(u.id, payload)));
}
