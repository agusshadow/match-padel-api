import * as courtScheduleService from '../services/courtScheduleService.js';

// Obtener todos los horarios
const getAllSchedules = async (req, res) => {
  try {
    const filters = {
      courtId: req.query.courtId,
      dayOfWeek: req.query.dayOfWeek,
      isAvailable: req.query.isAvailable !== undefined ? req.query.isAvailable === 'true' : undefined
    };

    const schedules = await courtScheduleService.getAllSchedules(filters);

    res.json({
      success: true,
      message: 'Horarios obtenidos exitosamente',
      data: schedules,
      count: schedules.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener un horario por ID
const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de horario inválido'
      });
    }

    const schedule = await courtScheduleService.getScheduleById(parseInt(id));

    res.json({
      success: true,
      message: 'Horario obtenido exitosamente',
      data: schedule
    });
  } catch (error) {
    const statusCode = error.message === 'Horario no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener horarios de una cancha específica
const getSchedulesByCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    
    if (!courtId || isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const schedules = await courtScheduleService.getSchedulesByCourt(parseInt(courtId));

    res.json({
      success: true,
      message: 'Horarios de la cancha obtenidos exitosamente',
      data: schedules,
      count: schedules.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener horarios por día de la semana
const getSchedulesByDay = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    
    if (dayOfWeek === undefined || isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        success: false,
        message: 'Día de la semana inválido (0-6, donde 0 es Domingo)'
      });
    }

    const schedules = await courtScheduleService.getSchedulesByDay(parseInt(dayOfWeek));

    res.json({
      success: true,
      message: 'Horarios del día obtenidos exitosamente',
      data: schedules,
      count: schedules.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Crear un nuevo horario
const createSchedule = async (req, res) => {
  try {
    const { courtId, dayOfWeek, startTime, endTime, isAvailable = true, price } = req.body;

    // Validaciones básicas
    if (!courtId || dayOfWeek === undefined || !startTime || !endTime || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'courtId, dayOfWeek, startTime, endTime y price son requeridos'
      });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        success: false,
        message: 'dayOfWeek debe estar entre 0 y 6 (0=Domingo, 6=Sábado)'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'El precio no puede ser negativo'
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

    const scheduleData = {
      courtId: parseInt(courtId),
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      isAvailable,
      price: parseFloat(price)
    };

    const newSchedule = await courtScheduleService.createSchedule(scheduleData);

    res.status(201).json({
      success: true,
      message: 'Horario creado exitosamente',
      data: newSchedule
    });
  } catch (error) {
    const statusCode = error.message.includes('Ya existe') ? 409 : 
                      error.message.includes('no encontrada') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar un horario
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de horario inválido'
      });
    }

    // Validaciones opcionales
    if (updateData.dayOfWeek !== undefined && (updateData.dayOfWeek < 0 || updateData.dayOfWeek > 6)) {
      return res.status(400).json({
        success: false,
        message: 'dayOfWeek debe estar entre 0 y 6 (0=Domingo, 6=Sábado)'
      });
    }

    if (updateData.price !== undefined && updateData.price < 0) {
      return res.status(400).json({
        success: false,
        message: 'El precio no puede ser negativo'
      });
    }

    // Validar formato de hora si se proporciona
    if (updateData.startTime || updateData.endTime) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if ((updateData.startTime && !timeRegex.test(updateData.startTime)) ||
          (updateData.endTime && !timeRegex.test(updateData.endTime))) {
        return res.status(400).json({
          success: false,
          message: 'Formato de hora inválido. Use HH:MM'
        });
      }
    }

    const updatedSchedule = await courtScheduleService.updateSchedule(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Horario actualizado exitosamente',
      data: updatedSchedule
    });
  } catch (error) {
    const statusCode = error.message === 'Horario no encontrado' ? 404 : 
                      error.message.includes('Ya existe') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar un horario
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de horario inválido'
      });
    }

    const result = await courtScheduleService.deleteSchedule(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Horario no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Crear horarios por defecto para una cancha
const createDefaultSchedules = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { defaultPrice = 3000 } = req.body;

    if (!courtId || isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    if (defaultPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'El precio por defecto no puede ser negativo'
      });
    }

    const schedules = await courtScheduleService.createDefaultSchedules(parseInt(courtId), defaultPrice);

    res.status(201).json({
      success: true,
      message: 'Horarios por defecto creados exitosamente',
      data: schedules,
      count: schedules.length
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrada') ? 404 : 
                      error.message.includes('ya tiene horarios') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener precio para una fecha y hora específicas
const getPriceForDateTime = async (req, res) => {
  try {
    const { courtId, dayOfWeek, time } = req.query;

    if (!courtId || dayOfWeek === undefined || !time) {
      return res.status(400).json({
        success: false,
        message: 'courtId, dayOfWeek y time son requeridos'
      });
    }

    if (isNaN(courtId) || isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        success: false,
        message: 'courtId debe ser un número y dayOfWeek debe estar entre 0 y 6'
      });
    }

    // Validar formato de hora
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Use HH:MM'
      });
    }

    const price = await courtScheduleService.getPriceForDateTime(
      parseInt(courtId),
      parseInt(dayOfWeek),
      time
    );

    res.json({
      success: true,
      message: 'Precio obtenido exitosamente',
      data: {
        courtId: parseInt(courtId),
        dayOfWeek: parseInt(dayOfWeek),
        time,
        price
      }
    });
  } catch (error) {
    const statusCode = error.message.includes('No hay horario disponible') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getAllSchedules,
  getScheduleById,
  getSchedulesByCourt,
  getSchedulesByDay,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createDefaultSchedules,
  getPriceForDateTime
};
