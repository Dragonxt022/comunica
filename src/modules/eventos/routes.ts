import { Router } from 'express';
import * as EventoController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.get('/', isAuthenticated, EventoController.list);
router.get('/novo', isAuthenticated, EventoController.createView);
router.post('/', isAuthenticated, EventoController.store);

export default router;
