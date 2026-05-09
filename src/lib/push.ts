import webpush from 'web-push';
import PushSubscription from '../database/models/PushSubscription.ts';
import { User } from '../database/models/index.ts';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@comunica.gov.br'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = await PushSubscription.findAll({ where: { user_id: userId } });
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...payload, icon: '/icon.svg' })
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sub.destroy();
      }
    }
  }));
}

export async function sendToRole(role: string | string[], payload: PushPayload): Promise<void> {
  const roles = Array.isArray(role) ? role : [role];
  const users = await User.findAll({ where: { role: roles, ativo: true } });
  await Promise.allSettled(users.map((u) => sendToUser(u.id, payload)));
}

export async function sendToAll(payload: PushPayload): Promise<void> {
  const users = await User.findAll({ where: { ativo: true } });
  await Promise.allSettled(users.map((u) => sendToUser(u.id, payload)));
}
