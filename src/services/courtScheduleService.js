import CourtSchedule from '../models/CourtSchedule.js';

// Obtener todos los horarios
const getAllSchedules = async () => {
  return await CourtSchedule.findAll();
};

// Obtener horarios por cancha
const getSchedulesByCourt = async (courtId) => {
  return await CourtSchedule.findAll({
    where: { courtId },
    include: [
      {
        association: 'court',
        include: [
          {
            association: 'club'
          }
        ]
      }
    ]
  });
};

// Obtener un horario por ID
const getScheduleById = async (id) => {
  return await CourtSchedule.findByPk(id);
};

// Crear un nuevo horario
const createSchedule = async (scheduleData) => {
  return await CourtSchedule.create(scheduleData);
};

// Actualizar un horario
const updateSchedule = async (id, updateData) => {
  const schedule = await CourtSchedule.findByPk(id);
  if (!schedule) throw new Error('Horario no encontrado');
  return await schedule.update(updateData);
};

// Eliminar un horario
const deleteSchedule = async (id) => {
  const schedule = await CourtSchedule.findByPk(id);
  if (!schedule) throw new Error('Horario no encontrado');
  return await schedule.destroy();
};

export {
  getAllSchedules,
  getSchedulesByCourt,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule
};