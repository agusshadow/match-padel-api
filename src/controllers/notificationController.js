import * as notificationService from '../services/notificationService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todas las notificaciones del usuario
const getMyNotifications = async (req, res) => {
  try {
    const { limit, offset, read } = req.query;
    const notifications = await notificationService.getUserNotifications(req.user.id, {
      limit,
      offset,
      read: read !== undefined ? read === 'true' : null
    });

    return successList(res, notifications);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener notificaciones no leídas
const getUnreadNotifications = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const notifications = await notificationService.getUnreadNotifications(req.user.id, limit);
    const unreadCount = await notificationService.countUnreadNotifications(req.user.id);

    // Incluir unreadCount dentro de data como objeto
    return successObject(res, { notifications, unreadCount });
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Contar notificaciones no leídas
const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.countUnreadNotifications(req.user.id);
    return successObject(res, { unreadCount: count });
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Marcar notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);

    return successObject(res, notification, 200, 'Notificación marcada como leída');
  } catch (err) {
    const statusCode = err.message.includes('no encontrada') ? 404 : 500;
    const errorCode = statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

// Marcar todas las notificaciones como leídas
const markAllAsRead = async (req, res) => {
  try {
    const updatedCount = await notificationService.markAllAsRead(req.user.id);

    return successObject(res, { updatedCount }, 200, `${updatedCount} notificaciones marcadas como leídas`);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar notificación
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id, req.user.id);

    return successObject(res, null, 200, 'Notificación eliminada');
  } catch (err) {
    const statusCode = err.message.includes('no encontrada') ? 404 : 500;
    const errorCode = statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

export {
  getMyNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};

