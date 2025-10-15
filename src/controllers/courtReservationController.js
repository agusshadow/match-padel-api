import * as courtReservationService from '../services/courtReservationService.js';

// Obtener todas las reservas
const getAllReservations = async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      courtId: req.query.courtId,
      status: req.query.status,
      scheduledDate: req.query.scheduledDate,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const reservations = await courtReservationService.getAllReservations(filters);

    res.json({
      success: true,
      message: 'Reservas obtenidas exitosamente',
      data: reservations,
      count: reservations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener una reserva por ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    const reservation = await courtReservationService.getReservationById(parseInt(id));

    res.json({
      success: true,
      message: 'Reserva obtenida exitosamente',
      data: reservation
    });
  } catch (error) {
    const statusCode = error.message === 'Reserva no encontrada' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener reservas del usuario autenticado
const getMyReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const reservations = await courtReservationService.getUserReservations(userId, filters);

    res.json({
      success: true,
      message: 'Mis reservas obtenidas exitosamente',
      data: reservations,
      count: reservations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Crear una nueva reserva
const createReservation = async (req, res) => {
  try {
    const { courtId, scheduledDate, startTime, endTime } = req.body;
    const userId = req.user.id;

    // Validaciones básicas
    if (!courtId || !scheduledDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'courtId, scheduledDate, startTime y endTime son requeridos'
      });
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduledDate)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Use YYYY-MM-DD'
      });
    }

    // Validar formato de hora
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Use HH:MM'
      });
    }

    const reservationData = {
      courtId: parseInt(courtId),
      userId,
      scheduledDate,
      startTime,
      endTime
    };

    const newReservation = await courtReservationService.createReservation(reservationData);

    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente',
      data: newReservation
    });
  } catch (error) {
    const statusCode = error.message.includes('no está disponible') ? 409 : 
                      error.message.includes('fechas pasadas') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar una reserva
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    // Validar que el usuario solo pueda actualizar sus propias reservas (a menos que sea admin)
    if (req.user.role !== 'admin') {
      const reservation = await courtReservationService.getReservationById(parseInt(id));
      if (reservation.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar esta reserva'
        });
      }
    }

    const updatedReservation = await courtReservationService.updateReservation(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Reserva actualizada exitosamente',
      data: updatedReservation
    });
  } catch (error) {
    const statusCode = error.message === 'Reserva no encontrada' ? 404 : 
                      error.message.includes('no está disponible') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Cancelar una reserva
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    // Validar que el usuario solo pueda cancelar sus propias reservas (a menos que sea admin)
    if (req.user.role !== 'admin') {
      const reservation = await courtReservationService.getReservationById(parseInt(id));
      if (reservation.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cancelar esta reserva'
        });
      }
    }

    const cancelledReservation = await courtReservationService.cancelReservation(parseInt(id));

    res.json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: cancelledReservation
    });
  } catch (error) {
    const statusCode = error.message === 'Reserva no encontrada' ? 404 : 
                      error.message.includes('ya está cancelada') ? 400 :
                      error.message.includes('completada') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Confirmar una reserva (solo admin)
const confirmReservation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    const confirmedReservation = await courtReservationService.confirmReservation(parseInt(id));

    res.json({
      success: true,
      message: 'Reserva confirmada exitosamente',
      data: confirmedReservation
    });
  } catch (error) {
    const statusCode = error.message === 'Reserva no encontrada' ? 404 : 
                      error.message.includes('pendientes') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar una reserva
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva inválido'
      });
    }

    // Validar que el usuario solo pueda eliminar sus propias reservas (a menos que sea admin)
    if (req.user.role !== 'admin') {
      const reservation = await courtReservationService.getReservationById(parseInt(id));
      if (reservation.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar esta reserva'
        });
      }
    }

    const result = await courtReservationService.deleteReservation(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Reserva no encontrada' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Verificar disponibilidad de cancha
const checkAvailability = async (req, res) => {
  try {
    const { courtId, scheduledDate, startTime, endTime } = req.query;

    if (!courtId || !scheduledDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'courtId, scheduledDate, startTime y endTime son requeridos'
      });
    }

    const isAvailable = await courtReservationService.checkCourtAvailability(
      parseInt(courtId),
      scheduledDate,
      startTime,
      endTime
    );

    res.json({
      success: true,
      message: 'Disponibilidad verificada',
      data: {
        isAvailable,
        courtId: parseInt(courtId),
        scheduledDate,
        startTime,
        endTime
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getAllReservations,
  getReservationById,
  getMyReservations,
  createReservation,
  updateReservation,
  cancelReservation,
  confirmReservation,
  deleteReservation,
  checkAvailability
};
