import * as clubService from '../services/clubService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todos los clubes
const getAllClubs = async (req, res) => {
  try {
    const clubs = await clubService.getAllClubs();
    return successList(res, clubs);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener un club por ID
const getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    const club = await clubService.getClubById(id);
    return successObject(res, club);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear un nuevo club
const createClub = async (req, res) => {
  try {
    const club = await clubService.createClub(req.body);
    return successObject(res, club, 201, 'Club creado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar un club
const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const club = await clubService.updateClub(id, req.body);
    return successObject(res, club, 200, 'Club actualizado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar un club
const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;
    await clubService.deleteClub(id);
    return successObject(res, null, 200, 'Club eliminado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAllClubs,
  getClubById,
  createClub,
  updateClub,
  deleteClub
};