import CourtSchedule from '../models/CourtSchedule.js';
import Court from '../models/Court.js';
import { Op } from 'sequelize';

// Obtener todos los horarios
const getAllSchedules = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.courtId) {
      whereClause.courtId = filters.courtId;
    }
    
    if (filters.dayOfWeek !== undefined) {
      whereClause.dayOfWeek = filters.dayOfWeek;
    }
    
    if (filters.isAvailable !== undefined) {
      whereClause.isAvailable = filters.isAvailable;
    }

    const schedules = await CourtSchedule.findAll({
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
      order: [['courtId', 'ASC'], ['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    return schedules;
  } catch (error) {
    throw new Error(`Error al obtener horarios: ${error.message}`);
  }
};

// Obtener un horario por ID
const getScheduleById = async (id) => {
  try {
    const schedule = await CourtSchedule.findByPk(id, {
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
      ]
    });

    if (!schedule) {
      throw new Error('Horario no encontrado');
    }

    return schedule;
  } catch (error) {
    throw new Error(`Error al obtener horario: ${error.message}`);
  }
};

// Obtener horarios de una cancha específica
const getSchedulesByCourt = async (courtId) => {
  try {
    const schedules = await CourtSchedule.findAll({
      where: { courtId },
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
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    return schedules;
  } catch (error) {
    throw new Error(`Error al obtener horarios de la cancha: ${error.message}`);
  }
};

// Obtener horarios por día de la semana
const getSchedulesByDay = async (dayOfWeek) => {
  try {
    const schedules = await CourtSchedule.findAll({
      where: { dayOfWeek },
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
      order: [['courtId', 'ASC'], ['startTime', 'ASC']]
    });

    return schedules;
  } catch (error) {
    throw new Error(`Error al obtener horarios del día: ${error.message}`);
  }
};

// Crear un nuevo horario
const createSchedule = async (scheduleData) => {
  try {
    const { courtId, dayOfWeek, startTime, endTime, isAvailable = true, price } = scheduleData;

    // Verificar que la cancha existe
    const court = await Court.findByPk(courtId);
    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que no existe un horario duplicado
    const existingSchedule = await CourtSchedule.findOne({
      where: {
        courtId,
        dayOfWeek,
        startTime
      }
    });

    if (existingSchedule) {
      throw new Error('Ya existe un horario para esta cancha en el mismo día y hora');
    }

    // Validar que startTime < endTime
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    if (start >= end) {
      throw new Error('La hora de inicio debe ser anterior a la hora de fin');
    }

    // Validar precio
    if (price < 0) {
      throw new Error('El precio no puede ser negativo');
    }

    const newSchedule = await CourtSchedule.create({
      courtId,
      dayOfWeek,
      startTime,
      endTime,
      isAvailable,
      price
    });

    // Retornar horario con información completa
    return await getScheduleById(newSchedule.id);
  } catch (error) {
    throw new Error(`Error al crear horario: ${error.message}`);
  }
};

// Actualizar un horario
const updateSchedule = async (id, updateData) => {
  try {
    const schedule = await CourtSchedule.findByPk(id);
    if (!schedule) {
      throw new Error('Horario no encontrado');
    }

    // Si se está actualizando el horario, verificar que no haya duplicados
    if (updateData.dayOfWeek || updateData.startTime) {
      const courtId = updateData.courtId || schedule.courtId;
      const dayOfWeek = updateData.dayOfWeek || schedule.dayOfWeek;
      const startTime = updateData.startTime || schedule.startTime;

      const existingSchedule = await CourtSchedule.findOne({
        where: {
          courtId,
          dayOfWeek,
          startTime,
          id: {
            [Op.ne]: id
          }
        }
      });

      if (existingSchedule) {
        throw new Error('Ya existe un horario para esta cancha en el mismo día y hora');
      }
    }

    // Validar que startTime < endTime si se actualiza
    if (updateData.startTime || updateData.endTime) {
      const startTime = updateData.startTime || schedule.startTime;
      const endTime = updateData.endTime || schedule.endTime;
      
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      if (start >= end) {
        throw new Error('La hora de inicio debe ser anterior a la hora de fin');
      }
    }

    // Validar precio
    if (updateData.price !== undefined && updateData.price < 0) {
      throw new Error('El precio no puede ser negativo');
    }

    await schedule.update(updateData);
    return await getScheduleById(id);
  } catch (error) {
    throw new Error(`Error al actualizar horario: ${error.message}`);
  }
};

// Eliminar un horario
const deleteSchedule = async (id) => {
  try {
    const schedule = await CourtSchedule.findByPk(id);
    if (!schedule) {
      throw new Error('Horario no encontrado');
    }

    await schedule.destroy();
    return { message: 'Horario eliminado correctamente' };
  } catch (error) {
    throw new Error(`Error al eliminar horario: ${error.message}`);
  }
};

// Crear horarios por defecto para una cancha (todos los días de la semana)
const createDefaultSchedules = async (courtId, defaultPrice = 3000) => {
  try {
    const court = await Court.findByPk(courtId);
    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que no existan horarios para esta cancha
    const existingSchedules = await CourtSchedule.findAll({
      where: { courtId }
    });

    if (existingSchedules.length > 0) {
      throw new Error('La cancha ya tiene horarios configurados');
    }

    const schedules = [];
    const daysOfWeek = [0, 1, 2, 3, 4, 5, 6]; // Domingo a Sábado
    const defaultTimes = {
      start: '08:00:00',
      end: '22:00:00'
    };

    for (const dayOfWeek of daysOfWeek) {
      // Ajustar horarios para fines de semana
      let startTime = defaultTimes.start;
      let endTime = defaultTimes.end;
      let price = defaultPrice;

      if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o Sábado
        startTime = '09:00:00';
        endTime = '21:00:00';
        price = Math.round(defaultPrice * 1.2); // 20% más caro en fines de semana
      }

      const schedule = await CourtSchedule.create({
        courtId,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable: true,
        price
      });

      schedules.push(schedule);
    }

    return schedules;
  } catch (error) {
    throw new Error(`Error al crear horarios por defecto: ${error.message}`);
  }
};

// Obtener precio para una cancha en un día y hora específicos
const getPriceForDateTime = async (courtId, dayOfWeek, time) => {
  try {
    const schedule = await CourtSchedule.findOne({
      where: {
        courtId,
        dayOfWeek,
        startTime: {
          [Op.lte]: time
        },
        endTime: {
          [Op.gt]: time
        },
        isAvailable: true
      }
    });

    if (!schedule) {
      throw new Error('No hay horario disponible para esa fecha y hora');
    }

    return schedule.price;
  } catch (error) {
    throw new Error(`Error al obtener precio: ${error.message}`);
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
