import { Router } from 'express';
import * as IaController from './controller.ts';
import { hasRole } from '../../middlewares/auth.middleware.ts';

const router = Router();
const onlyAdmin = hasRole(['admin']);

router.get('/perfil', onlyAdmin, IaController.perfilView);
router.post('/perfil', onlyAdmin, IaController.savePerfil);
router.post('/testar-modelo', onlyAdmin, IaController.testarModelo);

router.post('/sugerir-descricao', IaController.sugerirDescricao);
router.post('/corrigir-texto', IaController.corrigirTexto);

export default router;
