import * as courtService from '../services/courtService.js';

// Obtener todas las canchas
const getAllCourts = async (req, res) => {
  try {
    const courts = await courtService.getAllCourts();
    res.json({ success: true, data: courts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener una cancha por ID
const getCourtById = async (req, res) => {
  try {
    const { id } = req.params;
    const court = await courtService.getCourtById(id);
    res.json({ success: true, data: court });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear una nueva cancha
const createCourt = async (req, res) => {
  try {
    const court = await courtService.createCourt(req.body);
    res.status(201).json({ success: true, data: court });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar una cancha
const updateCourt = async (req, res) => {
  try {
    const { id } = req.params;
    const court = await courtService.updateCourt(id, req.body);
    res.json({ success: true, data: court });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar una cancha
const deleteCourt = async (req, res) => {
  try {
    const { id } = req.params;
    await courtService.deleteCourt(id);
    res.json({ success: true, message: 'Cancha eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt
};