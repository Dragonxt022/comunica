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

router.get('/', isAuthenticated, SolicitacaoController.list);
router.get('/nova', isAuthenticated, SolicitacaoController.createView);
router.post('/', isAuthenticated, SolicitacaoController.store);
router.get('/:id', isAuthenticated, SolicitacaoController.show);
router.post('/:id/status', isAuthenticated, SolicitacaoController.updateStatus);
router.post('/:id/material', isAuthenticated, upload.single('arte_final'), SolicitacaoController.updateMaterial);
router.post('/:id/concluir', isAuthenticated, upload.single('arte_final'), SolicitacaoController.concluir);
router.post('/:id/comentarios', isAuthenticated, upload.single('arquivo'), SolicitacaoController.addComentario);
router.post('/:id/aprovar', isAuthenticated, SolicitacaoController.aprovar);
router.post('/:id/revisao', isAuthenticated, SolicitacaoController.pedirRevisao);
router.get('/:id/editar', isAuthenticated, SolicitacaoController.editView);
router.post('/:id/editar', isAuthenticated, SolicitacaoController.updateSolicitacao);

export default router;
