const express = require('express');
const router = express.Router();
const courtReservationController = require('../controllers/courtReservationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

module.exports = router;
