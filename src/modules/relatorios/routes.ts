import { Router } from 'express';
import * as RelatoriosController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

const isAdminOrSecom = (req: any, res: any, next: any) => {
  if (req.session?.user?.role === 'admin' || req.session?.user?.role === 'secom') return next();
  return res.status(403).redirect('/');
};

router.get('/', isAuthenticated, isAdminOrSecom, RelatoriosController.index);
router.post('/gerar', isAuthenticated, isAdminOrSecom, RelatoriosController.gerar);

export default router;
