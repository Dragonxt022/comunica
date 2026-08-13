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
router.post('/estruturar-chamado', IaController.estruturarChamado);
router.post('/variacoes-redes-sociais', IaController.variacoesRedesSociais);
router.post('/priorizar-fila', IaController.priorizarFila);
router.post('/pauta-editorial', IaController.pautaEditorial);

router.get('/olivia', IaController.oliviaView);
router.post('/olivia/mensagem', IaController.oliviaMensagem);
router.post('/olivia/limpar', IaController.oliviaLimpar);

export default router;
