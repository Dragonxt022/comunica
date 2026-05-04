import { Router } from 'express';
import * as SolicitacaoController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.get('/', isAuthenticated, SolicitacaoController.list);
router.get('/nova', isAuthenticated, SolicitacaoController.createView);
router.post('/', isAuthenticated, SolicitacaoController.store);

export default router;
