import { Router } from 'express';
import * as AuthController from './controller.ts';

const router = Router();

router.get('/login', AuthController.loginView);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);

export default router;
