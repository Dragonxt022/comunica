import { Router } from 'express';
import * as ReleasesController from './controller.ts';

const router = Router();

router.get('/', ReleasesController.list);
router.get('/novo', ReleasesController.createView);
router.post('/', ReleasesController.store);
router.get('/:id/editar', ReleasesController.editView);
router.post('/:id', ReleasesController.update);
router.post('/:id/excluir', ReleasesController.destroy);
router.post('/:id/publicar', ReleasesController.togglePublish);

export default router;
