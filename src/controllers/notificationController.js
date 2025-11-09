import * as notificationService from '../services/notificationService.js';

// Obtener todas las notificaciones del usuario
const getMyNotifications = async (req, res) => {
  try {
    const { limit, offset, read } = req.query;
    const notifications = await notificationService.getUserNotifications(req.user.id, {
      limit,
      offset,
      read: read !== undefined ? read === 'true' : null
    });

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener notificaciones no leídas
const getUnreadNotifications = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const notifications = await notificationService.getUnreadNotifications(req.user.id, limit);
    const unreadCount = await notificationService.countUnreadNotifications(req.user.id);

    res.json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Contar notificaciones no leídas
const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.countUnreadNotifications(req.user.id);
    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Marcar notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);

    res.json({
      success: true,
      data: notification,
      message: 'Notificación marcada como leída'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrada') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Marcar todas las notificaciones como leídas
const markAllAsRead = async (req, res) => {
  try {
    const updatedCount = await notificationService.markAllAsRead(req.user.id);

    res.json({
      success: true,
      data: { updatedCount },
      message: `${updatedCount} notificaciones marcadas como leídas`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar notificación
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id, req.user.id);

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrada') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
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

