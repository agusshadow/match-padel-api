import express from 'express';
const router = express.Router();
import * as courtSlotController from '../controllers/courtSlotController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Rutas públicas
router.get('/', courtSlotController.getAllSlots);
router.get('/by-court', courtSlotController.getSlotsByCourt);
// ⭐ NUEVO: Slots disponibles por fecha específica (recomendado)
router.get('/available', courtSlotController.getAvailableSlotsByCourtAndDate);
// Método antiguo: por día de semana (mantener por compatibilidad)
router.get('/available-by-day', courtSlotController.getAvailableSlotsByCourtAndDay);
router.get('/:id', courtSlotController.getSlotById);

// Rutas protegidas para administradores
router.post('/', authenticateToken, requireAdmin, courtSlotController.createSlot);
router.put('/:id', authenticateToken, requireAdmin, courtSlotController.updateSlot);
router.delete('/:id', authenticateToken, requireAdmin, courtSlotController.deleteSlot);

export default router;
