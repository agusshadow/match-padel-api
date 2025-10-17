import * as courtSlotService from '../services/courtSlotService.js';

// Obtener todos los slots
const getAllSlots = async (req, res) => {
  try {
    const slots = await courtSlotService.getAllSlots();
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener slots por cancha
const getSlotsByCourt = async (req, res) => {
  try {
    const { courtId } = req.query;
    if (!courtId) {
      return res.status(400).json({ 
        success: false, 
        message: 'courtId es requerido como query parameter' 
      });
    }
    const slots = await courtSlotService.getSlotsByCourt(courtId);
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un slot por ID
const getSlotById = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await courtSlotService.getSlotById(id);
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear un nuevo slot
const createSlot = async (req, res) => {
  try {
    const slot = await courtSlotService.createSlot(req.body);
    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar un slot
const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await courtSlotService.updateSlot(id, req.body);
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar un slot
const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    await courtSlotService.deleteSlot(id);
    res.json({ success: true, message: 'Slot eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener slots disponibles por cancha y día
const getAvailableSlotsByCourtAndDay = async (req, res) => {
  try {
    const { courtId, dayOfWeek } = req.query;
    if (!courtId || dayOfWeek === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'courtId y dayOfWeek son requeridos como query parameters' 
      });
    }
    const slots = await courtSlotService.getAvailableSlotsByCourtAndDay(courtId, dayOfWeek);
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllSlots,
  getSlotsByCourt,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  getAvailableSlotsByCourtAndDay
};