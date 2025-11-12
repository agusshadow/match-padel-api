import express from 'express';
const router = express.Router();
import * as matchController from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.get('/', matchController.getAllMatches);
router.get('/detailed', matchController.getAllMatchesDetailed);
// Ruta para partidos disponibles (puede ser pública o protegida)
// Si el usuario está autenticado, excluirá sus propios partidos
router.get('/available', authenticateToken, matchController.getAvailableMatches);

// Rutas protegidas (requieren autenticación)
// IMPORTANTE: /my-matches debe estar ANTES de /:id para evitar conflictos
router.get('/my-matches', authenticateToken, matchController.getUserMatches);
// IMPORTANTE: /:id/team-availability debe estar ANTES de /:id para evitar conflictos
router.get('/:id/team-availability', authenticateToken, matchController.getMatchTeamAvailability);

// Rutas públicas (continuación)
router.get('/:id', matchController.getMatchById);
router.get('/:id/detailed', matchController.getMatchByIdDetailed);
// ⭐ UNIFICADO: Crear partido (siempre con reserva)
router.post('/', authenticateToken, matchController.createMatchWithReservation);
// Endpoint antiguo mantenido por compatibilidad (redirige al nuevo)
router.post('/with-reservation', authenticateToken, matchController.createMatchWithReservation);
router.post('/:id/join', authenticateToken, matchController.joinMatch);
router.post('/:id/leave', authenticateToken, matchController.leaveMatch);
router.patch('/:id/start', authenticateToken, matchController.startMatch);
router.patch('/:id/finish', authenticateToken, matchController.finishMatch);
router.patch('/:id/confirm', authenticateToken, matchController.confirmMatch);
router.patch('/:id/cancel', authenticateToken, matchController.cancelMatch);
router.put('/:id', authenticateToken, matchController.updateMatch);
router.delete('/:id', authenticateToken, matchController.deleteMatch);

export default router;
