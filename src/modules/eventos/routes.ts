import { Router } from 'express';
import * as EventoController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.get('/', isAuthenticated, EventoController.list);
router.get('/novo', isAuthenticated, EventoController.createView);
router.post('/', isAuthenticated, EventoController.store);
router.post('/:id/status', isAuthenticated, EventoController.updateStatus);
router.get('/:id/editar', isAuthenticated, EventoController.editView);
router.post('/:id', isAuthenticated, EventoController.update);

export default router;
