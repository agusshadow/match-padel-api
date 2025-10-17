import express from 'express';
const router = express.Router();
import * as courtScheduleController from '../controllers/courtScheduleController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Rutas públicas
router.get('/', courtScheduleController.getAllSchedules);
router.get('/:id', courtScheduleController.getScheduleById);

// Rutas protegidas para administradores
router.post('/', authenticateToken, requireAdmin, courtScheduleController.createSchedule);
router.put('/:id', authenticateToken, requireAdmin, courtScheduleController.updateSchedule);
router.delete('/:id', authenticateToken, requireAdmin, courtScheduleController.deleteSchedule);

export default router;
