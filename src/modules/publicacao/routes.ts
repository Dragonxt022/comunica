import { Router } from 'express';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import * as Ctrl from './controller.ts';

const router = Router();

router.use(isAuthenticated);

router.get('/',                 Ctrl.list);
router.get('/pendentes-count',  Ctrl.pendentesCount);
router.post('/:id/publicar',    Ctrl.publicar);
router.post('/:id/despublicar', Ctrl.despublicar);

export default router;
