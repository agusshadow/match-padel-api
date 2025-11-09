import Notification from '../models/Notification.js';
import { Op } from 'sequelize';

// Obtener todas las notificaciones del usuario
const getUserNotifications = async (userId, options = {}) => {
  const { limit = 50, offset = 0, read = null } = options;

  const where = { userId };

  // Filtrar por estado de lectura si se especifica
  if (read !== null) {
    where.read = read === true;
  }

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return notifications;
};

// Obtener notificaciones no leídas del usuario
const getUnreadNotifications = async (userId, limit = 50) => {
  const notifications = await Notification.findAll({
    where: {
      userId,
      read: false
    },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit)
  });

  return notifications;
};

// Contar notificaciones no leídas
const countUnreadNotifications = async (userId) => {
  const count = await Notification.count({
    where: {
      userId,
      read: false
    }
  });

  return count;
};

// Marcar notificación como leída
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      userId // Verificar que la notificación pertenece al usuario
    }
  });

  if (!notification) {
    throw new Error('Notificación no encontrada');
  }

  if (notification.read) {
    return notification; // Ya está leída
  }

  await notification.update({
    read: true,
    readAt: new Date()
  });

  return notification;
};

// Marcar todas las notificaciones como leídas
const markAllAsRead = async (userId) => {
  const result = await Notification.update(
    {
      read: true,
      readAt: new Date()
    },
    {
      where: {
        userId,
        read: false
      }
    }
  );

  return result[0]; // Número de notificaciones actualizadas
};

// Eliminar notificación
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      userId // Verificar que la notificación pertenece al usuario
    }
  });

  if (!notification) {
    throw new Error('Notificación no encontrada');
  }

  await notification.destroy();
  return true;
};

export {
  getUserNotifications,
  getUnreadNotifications,
  countUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};

