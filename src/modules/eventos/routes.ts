import { Router } from 'express';
import * as EventoController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import { uploadCapa } from '../../middlewares/upload.middleware.ts';

const router = Router();

router.get('/historico', isAuthenticated, EventoController.historico);
router.get('/', isAuthenticated, EventoController.list);
router.get('/novo', isAuthenticated, EventoController.createView);
router.post('/', isAuthenticated, uploadCapa, EventoController.store);
router.post('/:id/status', isAuthenticated, EventoController.updateStatus);
router.post('/:id/arquivar', isAuthenticated, EventoController.arquivar);
router.post('/:id/excluir', isAuthenticated, EventoController.destroy);
router.post('/:id/remover-capa', isAuthenticated, EventoController.removeCapa);
router.get('/:id/editar', isAuthenticated, EventoController.editView);
router.post('/:id', isAuthenticated, uploadCapa, EventoController.update);

export default router;
