import { Router } from 'express';
import * as InscricaoPublicaController from './controller.ts';

const router = Router();

router.get('/:token', InscricaoPublicaController.formView);
router.post('/:token', InscricaoPublicaController.submit);
router.get('/:token/comprovante/:id', InscricaoPublicaController.comprovante);

export default router;
