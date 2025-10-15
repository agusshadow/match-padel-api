import express from 'express';
const router = express.Router();
import * as courtReservationController from '../controllers/courtReservationController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Rutas públicas
router.get('/availability', courtReservationController.checkAvailability);

// Rutas protegidas (requieren autenticación)
router.get('/my-reservations', authenticateToken, courtReservationController.getMyReservations);
router.post('/', authenticateToken, courtReservationController.createReservation);
router.get('/:id', authenticateToken, courtReservationController.getReservationById);
router.put('/:id', authenticateToken, courtReservationController.updateReservation);
router.put('/:id/cancel', authenticateToken, courtReservationController.cancelReservation);
router.delete('/:id', authenticateToken, courtReservationController.deleteReservation);

// Rutas protegidas (requieren autenticación y rol admin)
router.get('/', authenticateToken, requireAdmin, courtReservationController.getAllReservations);
router.put('/:id/confirm', authenticateToken, requireAdmin, courtReservationController.confirmReservation);

export default router;
