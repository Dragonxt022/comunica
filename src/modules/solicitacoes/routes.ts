import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as SolicitacaoController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../../public/uploads/solicitacoes');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `sol-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = Router();

router.get('/pendentes-count', isAuthenticated, SolicitacaoController.pendentesCount);
router.get('/', isAuthenticated, SolicitacaoController.list);
router.get('/nova', isAuthenticated, SolicitacaoController.createView);
router.post('/', isAuthenticated, SolicitacaoController.store);
router.post('/reordenar', isAuthenticated, SolicitacaoController.reordenar);
router.post('/upload-imagem', isAuthenticated, upload.single('imagem'), SolicitacaoController.uploadInlineImagem);
router.get('/:id', isAuthenticated, SolicitacaoController.show);
router.get('/:id/comentarios', isAuthenticated, SolicitacaoController.getComentariosJson);
router.post('/:id/status', isAuthenticated, SolicitacaoController.updateStatus);
router.post('/:id/material', isAuthenticated, upload.array('arte_final', 10), SolicitacaoController.updateMaterial);
router.post('/:id/concluir', isAuthenticated, upload.array('arte_final', 10), SolicitacaoController.concluir);
router.post('/:id/comentarios', isAuthenticated, upload.single('arquivo'), SolicitacaoController.addComentario);
router.post('/:id/aprovar', isAuthenticated, SolicitacaoController.aprovar);
router.post('/:id/revisao', isAuthenticated, SolicitacaoController.pedirRevisao);
router.get('/:id/editar', isAuthenticated, SolicitacaoController.editView);
router.post('/:id/editar', isAuthenticated, SolicitacaoController.updateSolicitacao);
router.post('/:id/imagens/:imagemId/excluir', isAuthenticated, SolicitacaoController.excluirImagem);
router.post('/:id/excluir', isAuthenticated, SolicitacaoController.destroy);

export default router;
