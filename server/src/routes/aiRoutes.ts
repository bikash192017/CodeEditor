import { Router } from 'express';
import { analyzeCode } from '../controllers/aiController.js';

const router = Router();

router.post('/analyze', analyzeCode);

export default router;
