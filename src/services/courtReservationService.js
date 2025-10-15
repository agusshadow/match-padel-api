import CourtReservation from '../models/CourtReservation.js';
import Court from '../models/Court.js';
import User from '../models/User.js';
import { Op } from 'sequelize';

// Obtener todas las reservas
const getAllReservations = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.userId) {
      whereClause.userId = filters.userId;
    }
    
    if (filters.courtId) {
      whereClause.courtId = filters.courtId;
    }
    
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.scheduledDate) {
      whereClause.scheduledDate = filters.scheduledDate;
    }
    
    if (filters.dateFrom && filters.dateTo) {
      whereClause.scheduledDate = {
        [Op.between]: [filters.dateFrom, filters.dateTo]
      };
    }

    const reservations = await CourtReservation.findAll({
      where: whereClause,
      include: [
        {
          model: Court,
          as: 'court',
          include: [
            {
              model: require('../models/Club'),
              as: 'club'
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['scheduledDate', 'ASC'], ['startTime', 'ASC']]
    });

    return reservations;
  } catch (error) {
    throw new Error(`Error al obtener reservas: ${error.message}`);
  }
};

// Obtener una reserva por ID
const getReservationById = async (id) => {
  try {
    const reservation = await CourtReservation.findByPk(id, {
      include: [
        {
          model: Court,
          as: 'court',
          include: [
            {
              model: require('../models/Club'),
              as: 'club'
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    return reservation;
  } catch (error) {
    throw new Error(`Error al obtener reserva: ${error.message}`);
  }
};

// Obtener reservas de un usuario específico
const getUserReservations = async (userId, filters = {}) => {
  try {
    const whereClause = { userId };
    
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.dateFrom && filters.dateTo) {
      whereClause.scheduledDate = {
        [Op.between]: [filters.dateFrom, filters.dateTo]
      };
    }

    const reservations = await CourtReservation.findAll({
      where: whereClause,
      include: [
        {
          model: Court,
          as: 'court',
          include: [
            {
              model: require('../models/Club'),
              as: 'club'
            }
          ]
        }
      ],
      order: [['scheduledDate', 'ASC'], ['startTime', 'ASC']]
    });

    return reservations;
  } catch (error) {
    throw new Error(`Error al obtener reservas del usuario: ${error.message}`);
  }
};

// Verificar disponibilidad de cancha
const checkCourtAvailability = async (courtId, scheduledDate, startTime, endTime, excludeReservationId = null) => {
  try {
    const whereClause = {
      courtId,
      scheduledDate,
      status: {
        [Op.in]: ['pending', 'confirmed']
      },
      [Op.or]: [
        {
          startTime: {
            [Op.lt]: endTime
          },
          endTime: {
            [Op.gt]: startTime
          }
        }
      ]
    };

    if (excludeReservationId) {
      whereClause.id = {
        [Op.ne]: excludeReservationId
      };
    }

    const conflictingReservations = await CourtReservation.findAll({
      where: whereClause
    });

    return conflictingReservations.length === 0;
  } catch (error) {
    throw new Error(`Error al verificar disponibilidad: ${error.message}`);
  }
};

// Crear una nueva reserva
const createReservation = async (reservationData) => {
  try {
    const { courtId, userId, scheduledDate, startTime, endTime } = reservationData;

    // Verificar que la cancha existe
    const court = await Court.findByPk(courtId);
    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que el usuario existe
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar disponibilidad
    const isAvailable = await checkCourtAvailability(courtId, scheduledDate, startTime, endTime);
    if (!isAvailable) {
      throw new Error('La cancha no está disponible en ese horario');
    }

    // Validar que la fecha no sea en el pasado
    const reservationDate = new Date(`${scheduledDate} ${startTime}`);
    const now = new Date();
    if (reservationDate <= now) {
      throw new Error('No se pueden hacer reservas en fechas pasadas');
    }

    // Validar duración (debe ser 90 minutos)
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const durationMinutes = (end - start) / (1000 * 60);
    
    if (durationMinutes !== 90) {
      throw new Error('La duración de la reserva debe ser exactamente 90 minutos');
    }

    // Calcular precio (esto podría venir de court-schedules en el futuro)
    const totalPrice = calculateReservationPrice(court, scheduledDate, startTime);

    const newReservation = await CourtReservation.create({
      courtId,
      userId,
      scheduledDate,
      startTime,
      endTime,
      status: 'pending',
      totalPrice
    });

    // Retornar reserva con información completa
    return await getReservationById(newReservation.id);
  } catch (error) {
    throw new Error(`Error al crear reserva: ${error.message}`);
  }
};

// Actualizar una reserva
const updateReservation = async (id, updateData) => {
  try {
    const reservation = await CourtReservation.findByPk(id);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    // Si se está actualizando horario, verificar disponibilidad
    if (updateData.scheduledDate || updateData.startTime || updateData.endTime) {
      const courtId = updateData.courtId || reservation.courtId;
      const scheduledDate = updateData.scheduledDate || reservation.scheduledDate;
      const startTime = updateData.startTime || reservation.startTime;
      const endTime = updateData.endTime || reservation.endTime;

      const isAvailable = await checkCourtAvailability(courtId, scheduledDate, startTime, endTime, id);
      if (!isAvailable) {
        throw new Error('La cancha no está disponible en ese horario');
      }
    }

    await reservation.update(updateData);
    return await getReservationById(id);
  } catch (error) {
    throw new Error(`Error al actualizar reserva: ${error.message}`);
  }
};

// Cancelar una reserva
const cancelReservation = async (id) => {
  try {
    const reservation = await CourtReservation.findByPk(id);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    if (reservation.status === 'cancelled') {
      throw new Error('La reserva ya está cancelada');
    }

    if (reservation.status === 'completed') {
      throw new Error('No se puede cancelar una reserva completada');
    }

    await reservation.update({ status: 'cancelled' });
    return await getReservationById(id);
  } catch (error) {
    throw new Error(`Error al cancelar reserva: ${error.message}`);
  }
};

// Confirmar una reserva
const confirmReservation = async (id) => {
  try {
    const reservation = await CourtReservation.findByPk(id);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    if (reservation.status !== 'pending') {
      throw new Error('Solo se pueden confirmar reservas pendientes');
    }

    await reservation.update({ status: 'confirmed' });
    return await getReservationById(id);
  } catch (error) {
    throw new Error(`Error al confirmar reserva: ${error.message}`);
  }
};

// Eliminar una reserva
const deleteReservation = async (id) => {
  try {
    const reservation = await CourtReservation.findByPk(id);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    await reservation.destroy();
    return { message: 'Reserva eliminada correctamente' };
  } catch (error) {
    throw new Error(`Error al eliminar reserva: ${error.message}`);
  }
};

// Función auxiliar para calcular precio (simplificada)
const calculateReservationPrice = (court, scheduledDate, startTime) => {
  // Esta es una implementación simplificada
  // En el futuro se podría consultar court-schedules para obtener el precio exacto
  const dayOfWeek = new Date(scheduledDate).getDay();
  
  // Precios base por tipo de cancha
  const basePrices = {
    'indoor': 3000,
    'covered': 2800,
    'outdoor': 2500
  };
  
  let price = basePrices[court.type] || 3000;
  
  // Aumentar precio en fines de semana
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    price *= 1.2;
  }
  
  // Aumentar precio en horarios nocturnos (después de las 20:00)
  const hour = parseInt(startTime.split(':')[0]);
  if (hour >= 20) {
    price *= 1.1;
  }
  
  return Math.round(price);
};

export {
  getAllReservations,
  getReservationById,
  getUserReservations,
  createReservation,
  updateReservation,
  cancelReservation,
  confirmReservation,
  deleteReservation,
  checkCourtAvailability
};
