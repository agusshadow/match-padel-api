import express from 'express';
const router = express.Router();
import * as courtReservationController from '../controllers/courtReservationController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Rutas públicas
router.get('/', courtReservationController.getAllReservations);
router.get('/:id', courtReservationController.getReservationById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, courtReservationController.createReservation);
router.put('/:id', authenticateToken, courtReservationController.updateReservation);
router.delete('/:id', authenticateToken, courtReservationController.deleteReservation);

export default router;
