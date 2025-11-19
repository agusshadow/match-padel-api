import * as courtService from '../services/courtService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todas las canchas
const getAllCourts = async (req, res) => {
  try {
    const courts = await courtService.getAllCourts();
    return successList(res, courts);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener canchas por club
const getCourtsByClub = async (req, res) => {
  try {
    const { clubId } = req.query;
    if (!clubId) {
      return error(res, 'clubId es requerido como query parameter', 400, 'VALIDATION_ERROR');
    }
    const courts = await courtService.getCourtsByClub(clubId);
    return successList(res, courts);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener una cancha por ID
const getCourtById = async (req, res) => {
  try {
    const { id } = req.params;
    const court = await courtService.getCourtById(id);
    return successObject(res, court);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear una nueva cancha
const createCourt = async (req, res) => {
  try {
    const court = await courtService.createCourt(req.body);
    return successObject(res, court, 201, 'Cancha creada exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar una cancha
const updateCourt = async (req, res) => {
  try {
    const { id } = req.params;
    const court = await courtService.updateCourt(id, req.body);
    return successObject(res, court, 200, 'Cancha actualizada exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar una cancha
const deleteCourt = async (req, res) => {
  try {
    const { id } = req.params;
    await courtService.deleteCourt(id);
    return successObject(res, null, 200, 'Cancha eliminada');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAllCourts,
  getCourtsByClub,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt
};