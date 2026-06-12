import { Router } from 'express';
import { hub } from './hub.controller.ts';

const router = Router();
router.get('/', hub);
export default router;
