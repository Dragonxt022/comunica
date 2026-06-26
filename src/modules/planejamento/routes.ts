import { Router } from 'express';
import * as C from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.get('/', isAuthenticated, C.list);
router.get('/novo', isAuthenticated, C.createView);
router.post('/', isAuthenticated, C.store);
router.get('/:id', isAuthenticated, C.show);
router.get('/:id/imprimir', isAuthenticated, C.imprimir);
router.get('/:id/editar', isAuthenticated, C.editView);
router.post('/:id/editar', isAuthenticated, C.update);
router.post('/:id/excluir', isAuthenticated, C.destroy);

// Ações
router.get('/:id/acoes/nova', isAuthenticated, C.createAcaoView);
router.get('/:id/acoes/:aId/editar', isAuthenticated, C.editAcaoView);
router.post('/:id/acoes', isAuthenticated, C.storeAcao);
router.post('/:id/acoes/:aId/editar', isAuthenticated, C.updateAcao);
router.post('/:id/acoes/:aId/excluir', isAuthenticated, C.destroyAcao);
router.post('/:id/acoes/:aId/status', isAuthenticated, C.updateStatusAcao);
router.post('/:id/acoes/:aId/desvincular-evento', isAuthenticated, C.desvincularEvento);

// Indicadores
router.get('/:id/indicadores/novo', isAuthenticated, C.createIndicadorView);
router.get('/:id/indicadores/:iId/editar', isAuthenticated, C.editIndicadorView);
router.post('/:id/indicadores', isAuthenticated, C.storeIndicador);
router.post('/:id/indicadores/:iId/editar', isAuthenticated, C.updateIndicador);
router.post('/:id/indicadores/:iId/excluir', isAuthenticated, C.destroyIndicador);

export default router;
