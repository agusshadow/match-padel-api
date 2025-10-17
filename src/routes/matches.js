import express from 'express';
const router = express.Router();
import * as matchController from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.get('/', matchController.getAllMatches);
router.get('/detailed', matchController.getAllMatchesDetailed);
router.get('/:id', matchController.getMatchById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, matchController.createMatch);
router.post('/with-reservation', authenticateToken, matchController.createMatchWithReservation);
router.put('/:id', authenticateToken, matchController.updateMatch);
router.delete('/:id', authenticateToken, matchController.deleteMatch);

export default router;
