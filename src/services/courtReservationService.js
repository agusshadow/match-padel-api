import CourtReservation from '../models/CourtReservation.js';

// Obtener todas las reservas
const getAllReservations = async () => {
  return await CourtReservation.findAll();
};

// Obtener una reserva por ID
const getReservationById = async (id) => {
  return await CourtReservation.findByPk(id);
};

// Crear una nueva reserva
const createReservation = async (reservationData) => {
  return await CourtReservation.create(reservationData);
};

// Actualizar una reserva
const updateReservation = async (id, updateData) => {
  const reservation = await CourtReservation.findByPk(id);
  if (!reservation) throw new Error('Reserva no encontrada');
  return await reservation.update(updateData);
};

// Eliminar una reserva
const deleteReservation = async (id) => {
  const reservation = await CourtReservation.findByPk(id);
  if (!reservation) throw new Error('Reserva no encontrada');
  return await reservation.destroy();
};

export {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};