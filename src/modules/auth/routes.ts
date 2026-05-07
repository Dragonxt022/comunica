import { Router } from 'express';
import * as AuthController from './controller.ts';
import { isAuthenticated } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.get('/login', AuthController.loginView);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);
router.get('/perfil', isAuthenticated, AuthController.perfilView);
router.post('/perfil', isAuthenticated, AuthController.perfilUpdate);

export default router;
