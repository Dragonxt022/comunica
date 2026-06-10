import { Router } from 'express';
import { hasRole } from '../../middlewares/auth.middleware.ts';
import * as FormulariosController from './controller.ts';

const router = Router();

router.get('/', hasRole(['admin', 'secom']), FormulariosController.list);
router.get('/novo', hasRole(['admin', 'secom']), FormulariosController.createView);
router.post('/', hasRole(['admin', 'secom']), FormulariosController.store);
router.get('/:id/editar', hasRole(['admin', 'secom']), FormulariosController.editView);
router.post('/:id', hasRole(['admin', 'secom']), FormulariosController.update);
router.post('/:id/deletar', hasRole(['admin', 'secom']), FormulariosController.destroy);
router.get('/:id/preview', FormulariosController.preview);

export default router;
