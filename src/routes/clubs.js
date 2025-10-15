import express from 'express';
const router = express.Router();
import * as clubController from '../controllers/clubController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.get('/', clubController.getAllClubs);
router.get('/city/:city', clubController.getClubsByCity);
router.get('/:id', clubController.getClubById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, clubController.createClub);
router.put('/:id', authenticateToken, clubController.updateClub);
router.delete('/:id', authenticateToken, clubController.deleteClub);

export default router;
