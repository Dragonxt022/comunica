import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import PushSubscription from '../../database/models/PushSubscription.ts';

const router = Router();

router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

router.post('/subscribe', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = (req as any).session.user.id;
    await PushSubscription.findOrCreate({
      where:    { user_id: userId, endpoint },
      defaults: { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    (req as any).session.user.pushAtivado = true;
    res.json({ ok: true });
  } catch (error) {
    console.error('push subscribe error:', error);
    res.status(500).json({ ok: false });
  }
});

router.post('/unsubscribe', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    const userId = (req as any).session.user.id;
    await PushSubscription.destroy({ where: { user_id: userId, endpoint } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

router.post('/mark-asked', isAuthenticated, (req: Request, res: Response) => {
  (req as any).session.user.pushPermissionAsked = true;
  res.json({ ok: true });
});

export default router;
