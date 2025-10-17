import * as courtScheduleService from '../services/courtScheduleService.js';

// Obtener todos los horarios
const getAllSchedules = async (req, res) => {
  try {
    const schedules = await courtScheduleService.getAllSchedules();
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener horarios por cancha
const getSchedulesByCourt = async (req, res) => {
  try {
    const { courtId } = req.query;
    if (!courtId) {
      return res.status(400).json({ 
        success: false, 
        message: 'courtId es requerido como query parameter' 
      });
    }
    const schedules = await courtScheduleService.getSchedulesByCourt(courtId);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un horario por ID
const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await courtScheduleService.getScheduleById(id);
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear un nuevo horario
const createSchedule = async (req, res) => {
  try {
    const schedule = await courtScheduleService.createSchedule(req.body);
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar un horario
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await courtScheduleService.updateSchedule(id, req.body);
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar un horario
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    await courtScheduleService.deleteSchedule(id);
    res.json({ success: true, message: 'Horario eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllSchedules,
  getSchedulesByCourt,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule
};