const express = require('express');
const router = express.Router();
const courtController = require('../controllers/courtController');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas
router.get('/', courtController.getAllCourts);
router.get('/club/:clubId', courtController.getCourtsByClub);
router.get('/type/:type', courtController.getCourtsByType);
router.get('/:id', courtController.getCourtById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, courtController.createCourt);
router.put('/:id', authenticateToken, courtController.updateCourt);
router.delete('/:id', authenticateToken, courtController.deleteCourt);

module.exports = router;
