import { Router } from 'express';
import { apiKeyAuth } from '../../middlewares/api-auth.middleware.ts';
import { listEventos, listSolicitacoes, createSolicitacao } from './controller.ts';

const router = Router();

router.use(apiKeyAuth);

router.get('/eventos', listEventos);
router.get('/solicitacoes', listSolicitacoes);
router.post('/solicitacoes', createSolicitacao);

export default router;
