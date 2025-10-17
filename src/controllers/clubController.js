import * as clubService from '../services/clubService.js';

// Obtener todos los clubes
const getAllClubs = async (req, res) => {
  try {
    const clubs = await clubService.getAllClubs();
    res.json({ success: true, data: clubs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un club por ID
const getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    const club = await clubService.getClubById(id);
    res.json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear un nuevo club
const createClub = async (req, res) => {
  try {
    const club = await clubService.createClub(req.body);
    res.status(201).json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar un club
const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const club = await clubService.updateClub(id, req.body);
    res.json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar un club
const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;
    await clubService.deleteClub(id);
    res.json({ success: true, message: 'Club eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllClubs,
  getClubById,
  createClub,
  updateClub,
  deleteClub
};