import { Router } from 'express';
import * as AdminController from './controller.ts';
import { hasRole } from '../../middlewares/auth.middleware.ts';

const router = Router();

const onlyAdmin = hasRole(['admin']);

router.get('/secretarias', onlyAdmin, AdminController.listSecretarias);
router.post('/secretarias', onlyAdmin, AdminController.storeSecretaria);
router.post('/secretarias/:id', onlyAdmin, AdminController.updateSecretaria);
router.post('/secretarias/:id/excluir', onlyAdmin, AdminController.destroySecretaria);

router.get('/usuarios', onlyAdmin, AdminController.listUsuarios);
router.post('/usuarios', onlyAdmin, AdminController.storeUsuario);
router.post('/usuarios/:id', onlyAdmin, AdminController.updateUsuario);
router.post('/usuarios/:id/toggle', onlyAdmin, AdminController.toggleUsuarioAtivo);

router.get('/configuracoes', onlyAdmin, AdminController.configView);
router.post('/configuracoes', onlyAdmin, AdminController.saveConfig);

export default router;
