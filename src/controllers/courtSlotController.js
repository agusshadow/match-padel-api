import * as courtSlotService from '../services/courtSlotService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todos los slots
const getAllSlots = async (req, res) => {
  try {
    const slots = await courtSlotService.getAllSlots();
    return successList(res, slots);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener slots por cancha
const getSlotsByCourt = async (req, res) => {
  try {
    const { courtId } = req.query;
    if (!courtId) {
      return error(res, 'courtId es requerido como query parameter', 400, 'VALIDATION_ERROR');
    }
    const slots = await courtSlotService.getSlotsByCourt(courtId);
    return successList(res, slots);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener un slot por ID
const getSlotById = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await courtSlotService.getSlotById(id);
    return successObject(res, slot);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear un nuevo slot
const createSlot = async (req, res) => {
  try {
    const slot = await courtSlotService.createSlot(req.body);
    return successObject(res, slot, 201, 'Slot creado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar un slot
const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await courtSlotService.updateSlot(id, req.body);
    return successObject(res, slot, 200, 'Slot actualizado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar un slot
const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    await courtSlotService.deleteSlot(id);
    return successObject(res, null, 200, 'Slot eliminado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener slots disponibles por cancha y día de semana (método antiguo - mantener por compatibilidad)
const getAvailableSlotsByCourtAndDay = async (req, res) => {
  try {
    const { courtId, dayOfWeek } = req.query;
    if (!courtId || dayOfWeek === undefined) {
      return error(res, 'courtId y dayOfWeek son requeridos como query parameters', 400, 'VALIDATION_ERROR');
    }
    const slots = await courtSlotService.getAvailableSlotsByCourtAndDay(courtId, dayOfWeek);
    return successList(res, slots);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// ⭐ NUEVO: Obtener slots disponibles por cancha y fecha específica
const getAvailableSlotsByCourtAndDate = async (req, res) => {
  try {
    const { courtId, date } = req.query;
    if (!courtId || !date) {
      return error(res, 'courtId y date son requeridos como query parameters. Formato de date: YYYY-MM-DD', 400, 'VALIDATION_ERROR');
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return error(res, 'Formato de fecha inválido. Use YYYY-MM-DD', 400, 'VALIDATION_ERROR');
    }

    const slots = await courtSlotService.getAvailableSlotsByCourtAndDate(courtId, date);
    return successList(res, slots);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAllSlots,
  getSlotsByCourt,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  getAvailableSlotsByCourtAndDay,
  getAvailableSlotsByCourtAndDate
};