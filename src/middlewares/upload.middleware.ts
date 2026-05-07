import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function getUploadDir(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const mon  = String(now.getMonth() + 1).padStart(2, '0');
  const dir  = path.join(process.cwd(), 'public', 'uploads', year, mon);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const multerDisk = multer({
  storage: multer.diskStorage({
    destination(_req: any, _file: any, cb: any) {
      cb(null, getUploadDir());
    },
    filename(_req: any, file: any, cb: any) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  fileFilter(_req: any, file: any, cb: any) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas: JPEG, PNG, GIF ou WebP'));
    }
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
}).single('imagem');

/**
 * Middleware de upload de imagem: salva diretamente em disco em public/uploads/YYYY/MM/.
 */
export function uploadImagem(req: any, res: any, done: (err?: any) => void) {
  multerDisk(req, res, (err: any) => {
    if (err) return done(err);
    done();
  });
}
