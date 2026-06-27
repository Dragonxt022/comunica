import { Router } from 'express';
import * as AdminController from './controller.ts';
import { hasRole } from '../../middlewares/auth.middleware.ts';

const router = Router();

const onlyAdmin = hasRole(['admin']);
const onlySuperAdmin = hasRole(['super_admin']);

router.post('/municipio-ativo', onlySuperAdmin, AdminController.setMunicipioAtivo);
router.get('/municipios', onlySuperAdmin, AdminController.listMunicipios);
router.get('/municipios/novo', onlySuperAdmin, AdminController.novoMunicipioView);
router.post('/municipios', onlySuperAdmin, AdminController.storeMunicipio);
router.get('/municipios/:id/editar', onlySuperAdmin, AdminController.editMunicipioView);
router.post('/municipios/:id', onlySuperAdmin, AdminController.updateMunicipio);
router.post('/municipios/:id/excluir', onlySuperAdmin, AdminController.destroyMunicipio);

router.get('/secretarias/por-municipio', onlySuperAdmin, AdminController.secretariasPorMunicipio);
router.get('/secretarias', onlyAdmin, AdminController.listSecretarias);
router.get('/secretarias/nova', onlyAdmin, AdminController.novaSecretariaView);
router.post('/secretarias', onlyAdmin, AdminController.storeSecretaria);
router.get('/secretarias/:id/editar', onlyAdmin, AdminController.editSecretariaView);
router.post('/secretarias/:id', onlyAdmin, AdminController.updateSecretaria);
router.post('/secretarias/:id/excluir', onlyAdmin, AdminController.destroySecretaria);

router.get('/usuarios', onlyAdmin, AdminController.listUsuarios);
router.get('/usuarios/novo', onlyAdmin, AdminController.novoUsuarioView);
router.post('/usuarios', onlyAdmin, AdminController.storeUsuario);
router.get('/usuarios/:id/editar', onlyAdmin, AdminController.editUsuarioView);
router.post('/usuarios/:id', onlyAdmin, AdminController.updateUsuario);
router.post('/usuarios/:id/toggle', onlyAdmin, AdminController.toggleUsuarioAtivo);
router.post('/usuarios/:id/excluir', onlyAdmin, AdminController.destroyUsuario);

router.get('/configuracoes', onlyAdmin, AdminController.configView);
router.post('/configuracoes', onlyAdmin, AdminController.saveConfig);

router.get('/armazenamento', onlyAdmin, AdminController.storageView);
router.post('/armazenamento/deletar', onlyAdmin, AdminController.deleteUploadFile);

export default router;
