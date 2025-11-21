import express from 'express';
const router = express.Router();
import * as matchController from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

router.get('/', matchController.getAllMatches);
router.get('/detailed', matchController.getAllMatchesDetailed);
router.get('/available', authenticateToken, matchController.getAvailableMatches);

router.get('/my-matches', authenticateToken, matchController.getUserMatches);
router.get('/:id/team-availability', authenticateToken, matchController.getMatchTeamAvailability);

router.get('/:id', matchController.getMatchById);
router.get('/:id/detailed', matchController.getMatchByIdDetailed);
router.post('/', authenticateToken, matchController.createMatchWithReservation);
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
