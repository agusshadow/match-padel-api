import * as matchService from '../services/matchService.js';

// Obtener todos los matches
const getAllMatches = async (req, res) => {
  try {
    const matches = await matchService.getAllMatches();
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un match por ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchById(id);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear un nuevo match
const createMatch = async (req, res) => {
  try {
    const match = await matchService.createMatch(req.body);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar un match
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.updateMatch(id, req.body);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar un match
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    await matchService.deleteMatch(id);
    res.json({ success: true, message: 'Match eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener todos los matches con información detallada
const getAllMatchesDetailed = async (req, res) => {
  try {
    const matches = await matchService.getAllMatchesDetailed();
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch,
  getAllMatchesDetailed
};
