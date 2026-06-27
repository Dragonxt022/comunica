import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import * as Chat from './controller.ts';

const router = Router();

// ── Multer — uploads de chat (imagens e áudio) ────────────────────────────────

const chatUploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/(jpeg|jpg|png|gif|webp)|audio\/(webm|ogg|mpeg|mp4|wav)|video\/webm)$/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido'));
  },
});

// ── Rotas ─────────────────────────────────────────────────────────────────────

router.get('/usuarios',            isAuthenticated, Chat.listarUsuarios);
router.get('/unread',              isAuthenticated, Chat.totalNaoLidas);
router.get('/conversas',           isAuthenticated, Chat.listarConversas);
router.post('/conversas/dm',       isAuthenticated, Chat.abrirDM);
router.post('/conversas/grupo',    isAuthenticated, Chat.criarGrupo);
router.get('/conversas/:id/mensagens', isAuthenticated, Chat.buscarMensagens);
router.post('/conversas/:id/mensagens', isAuthenticated, Chat.enviarMensagem);
router.post('/conversas/:id/lida',      isAuthenticated, Chat.marcarLida);
router.post('/conversas/:id/digitando', isAuthenticated, Chat.notificarDigitando);
router.delete('/mensagens/:msgId', isAuthenticated, Chat.excluirMensagem);
router.post('/upload',             isAuthenticated, upload.single('file'), Chat.uploadArquivo);
router.get('/keys/:userId',        isAuthenticated, Chat.getKey);
router.post('/keys',               isAuthenticated, Chat.salvarKey);
router.get('/storage-info',        isAuthenticated, Chat.storageInfo);

export default router;
