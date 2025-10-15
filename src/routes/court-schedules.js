import express from 'express';
const router = express.Router();
import * as courtScheduleController from '../controllers/courtScheduleController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Rutas públicas (consultas)
router.get('/', courtScheduleController.getAllSchedules);
router.get('/:id', courtScheduleController.getScheduleById);
router.get('/court/:courtId', courtScheduleController.getSchedulesByCourt);
router.get('/day/:dayOfWeek', courtScheduleController.getSchedulesByDay);
router.get('/price/check', courtScheduleController.getPriceForDateTime);

// Rutas protegidas para administradores
router.post('/', authenticateToken, requireAdmin, courtScheduleController.createSchedule);
router.put('/:id', authenticateToken, requireAdmin, courtScheduleController.updateSchedule);
router.delete('/:id', authenticateToken, requireAdmin, courtScheduleController.deleteSchedule);
router.post('/court/:courtId/default', authenticateToken, requireAdmin, courtScheduleController.createDefaultSchedules);

export default router;
