import express from 'express';
const router = express.Router();
import * as matchController from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.get('/', matchController.getAllMatches);
router.get('/player/:playerId', matchController.getMatchesByPlayer);
router.get('/club/:clubId', matchController.getMatchesByClub);
router.get('/:id', matchController.getMatchById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, matchController.createMatch);
router.put('/:id', authenticateToken, matchController.updateMatch);
router.delete('/:id', authenticateToken, matchController.deleteMatch);

// Rutas específicas para acciones de match
router.put('/:id/start', authenticateToken, matchController.startMatch);
router.put('/:id/cancel', authenticateToken, matchController.cancelMatch);
router.put('/:id/score', authenticateToken, matchController.updateMatchScore);

export default router;
