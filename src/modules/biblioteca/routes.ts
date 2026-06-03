import { Router } from 'express';
import * as BibliotecaController from './controller.ts';

const router = Router();
router.get('/', BibliotecaController.index);
export default router;
