import * as courtReservationService from '../services/courtReservationService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todas las reservas
const getAllReservations = async (req, res) => {
  try {
    const reservations = await courtReservationService.getAllReservations();
    return successList(res, reservations);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener una reserva por ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await courtReservationService.getReservationById(id);
    return successObject(res, reservation);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear una nueva reserva
const createReservation = async (req, res) => {
  try {
    const reservation = await courtReservationService.createReservation(req.body);
    return successObject(res, reservation, 201, 'Reserva creada exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar una reserva
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await courtReservationService.updateReservation(id, req.body);
    return successObject(res, reservation, 200, 'Reserva actualizada exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar una reserva
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;
    await courtReservationService.deleteReservation(id);
    return successObject(res, null, 200, 'Reserva eliminada');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};