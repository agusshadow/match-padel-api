import express from 'express';
const router = express.Router();
import * as experienceController from '../controllers/experienceController.js';
import { authenticateToken } from '../middleware/auth.js';

// Todas las rutas requieren autenticación
router.get('/me', authenticateToken, experienceController.getMyExperience);
router.get('/history', authenticateToken, experienceController.getMyExperienceHistory);

export default router;

