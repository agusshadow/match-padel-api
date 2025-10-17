import * as courtReservationService from '../services/courtReservationService.js';

// Obtener todas las reservas
const getAllReservations = async (req, res) => {
  try {
    const reservations = await courtReservationService.getAllReservations();
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener una reserva por ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await courtReservationService.getReservationById(id);
    res.json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear una nueva reserva
const createReservation = async (req, res) => {
  try {
    const reservation = await courtReservationService.createReservation(req.body);
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar una reserva
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await courtReservationService.updateReservation(id, req.body);
    res.json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar una reserva
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;
    await courtReservationService.deleteReservation(id);
    res.json({ success: true, message: 'Reserva eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};