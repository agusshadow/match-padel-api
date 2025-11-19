import express from 'express';
const router = express.Router();
import * as challengeController from '../controllers/challengeController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas (solo listar desafíos disponibles)
router.get('/', challengeController.getAllChallenges);

// Rutas protegidas (requieren autenticación)
router.get('/my', authenticateToken, challengeController.getMyChallenges);
router.get('/my/:id', authenticateToken, challengeController.getMyChallengeById);
router.post('/:id/claim', authenticateToken, challengeController.claimChallengeReward);

export default router;

