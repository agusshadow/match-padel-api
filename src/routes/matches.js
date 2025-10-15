const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authenticateToken } = require('../middleware/auth');

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

module.exports = router;
