import express from 'express';
const router = express.Router();
import * as courtController from '../controllers/courtController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.get('/', courtController.getAllCourts);
router.get('/by-club', courtController.getCourtsByClub);
router.get('/:id', courtController.getCourtById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, courtController.createCourt);
router.put('/:id', authenticateToken, courtController.updateCourt);
router.delete('/:id', authenticateToken, courtController.deleteCourt);

export default router;
