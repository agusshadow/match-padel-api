import express from 'express';
const router = express.Router();
import * as notificationController from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

// Todas las rutas requieren autenticación
router.get('/', authenticateToken, notificationController.getMyNotifications);
router.get('/unread', authenticateToken, notificationController.getUnreadNotifications);
router.get('/unread/count', authenticateToken, notificationController.getUnreadCount);
router.put('/:id/read', authenticateToken, notificationController.markAsRead);
router.put('/read-all', authenticateToken, notificationController.markAllAsRead);
router.delete('/:id', authenticateToken, notificationController.deleteNotification);

export default router;

