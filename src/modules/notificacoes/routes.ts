import { Router } from 'express';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import * as Ctrl from './controller.ts';

const router = Router();

router.use(isAuthenticated);

router.get('/',                 Ctrl.page);
router.get('/latest',           Ctrl.latest);
router.get('/unread-count',     Ctrl.unreadCount);
router.post('/:id/lida',        Ctrl.marcarLida);
router.post('/all-lida',        Ctrl.marcarTodasLidas);
router.delete('/:id',           Ctrl.excluir);
router.post('/excluir-lidas',   Ctrl.excluirLidas);
router.post('/excluir-todas',   Ctrl.excluirTodas);

export default router;
