import { Router, Request, Response, NextFunction } from 'express';
import * as ReleasesController from './controller.ts';
import { isAuthenticated, hasRole } from '../../middlewares/auth.middleware.ts';
import { uploadImagem } from '../../middlewares/upload.middleware.ts';

const router = Router();

const onlySecom = hasRole(['admin', 'secom']);

// Upload de imagem (apenas admin/secom)
router.post('/upload-imagem', onlySecom, (req: Request, res: Response, next: NextFunction) => {
  uploadImagem(req, res, (err: any) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    next();
  });
}, ReleasesController.uploadImagem);

router.get('/',              onlySecom, ReleasesController.list);
router.get('/novo',          onlySecom, ReleasesController.createView);
router.post('/',             onlySecom, ReleasesController.store);
router.get('/:id/editar',   onlySecom, ReleasesController.editView);
router.post('/:id',          onlySecom, ReleasesController.update);
router.post('/:id/excluir',  onlySecom, ReleasesController.destroy);
router.post('/:id/publicar', onlySecom, ReleasesController.togglePublish);

export default router;
