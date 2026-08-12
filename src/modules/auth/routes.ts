import { Router } from 'express';
import * as AuthController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';
import { uploadAvatar } from '../../middlewares/upload.middleware.ts';

const router = Router();

router.get('/login', AuthController.loginView);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);
router.get('/perfil', isAuthenticated, AuthController.perfilView);
router.post('/perfil', isAuthenticated, uploadAvatar, AuthController.perfilUpdate);
router.get('/dispositivos', isAuthenticated, AuthController.dispositivosView);
router.post('/dispositivos/:sid/encerrar', isAuthenticated, AuthController.encerrarDispositivo);

export default router;
