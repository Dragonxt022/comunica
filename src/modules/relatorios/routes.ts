import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as RelatoriosController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../../public/uploads/relatorios');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// Campos dinâmicos (reel_imagem_0, release_imagem_3, artes_imagens...) cujo número de
// linhas é decidido no formulário pelo usuário — .any() aceita qualquer fieldname e a
// controller agrupa por regex, já que .fields([...]) exigiria uma lista fixa no boot.
const uploadRelatorioMensal = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `rel-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas: JPEG, PNG, GIF ou WebP'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 60 },
}).any();

const router = Router();

const isAdminOrSecom = (req: any, res: any, next: any) => {
  const role = req.session?.user?.role;
  if (role === 'admin' || role === 'secom' || role === 'super_admin') return next();
  return res.status(403).redirect('/');
};

router.get('/', isAuthenticated, isAdminOrSecom, RelatoriosController.index);
router.post('/gerar', isAuthenticated, isAdminOrSecom, RelatoriosController.gerar);
router.get('/mensal/novo', isAuthenticated, isAdminOrSecom, RelatoriosController.mensalForm);
router.post('/mensal/gerar', isAuthenticated, isAdminOrSecom, uploadRelatorioMensal, RelatoriosController.mensalGerar);

export default router;
