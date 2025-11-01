import express from 'express';
const router = express.Router();
import * as matchScoreController from '../controllers/matchScoreController.js';
import { authenticateToken } from '../middleware/auth.js';

// Todas las rutas requieren autenticación
router.get('/:id', authenticateToken, matchScoreController.getMatchScore);
router.post('/:id', authenticateToken, matchScoreController.createMatchScore);
router.put('/:id', authenticateToken, matchScoreController.updateMatchScore);
router.patch('/:id/confirm', authenticateToken, matchScoreController.confirmMatchScore);
router.patch('/:id/reject', authenticateToken, matchScoreController.rejectMatchScore);

export default router;

