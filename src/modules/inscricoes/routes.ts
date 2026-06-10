import { Router } from 'express';
import * as InscricoesController from './controller.ts';

const router = Router({ mergeParams: true });

router.get('/config', InscricoesController.configView);
router.post('/config', InscricoesController.saveConfig);
router.get('/exportar', InscricoesController.exportarCSV);
router.get('/', InscricoesController.list);
router.get('/:id', InscricoesController.show);
router.post('/:id/status', InscricoesController.updateStatus);

export default router;
