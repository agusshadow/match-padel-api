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
  const mappedData = { ...reservationData };
  
  // Mapear camelCase a snake_case si existen
  if (reservationData.courtId) mappedData.court_id = reservationData.courtId;
  if (reservationData.userId) mappedData.user_id = reservationData.userId;
  if (reservationData.slotId) mappedData.slot_id = reservationData.slotId;
  if (reservationData.scheduledDate) mappedData.scheduled_date = reservationData.scheduledDate;
  if (reservationData.scheduledDateTime) mappedData.scheduled_date_time = reservationData.scheduledDateTime;
  if (reservationData.endDateTime) mappedData.end_date_time = reservationData.endDateTime;

  return await CourtReservation.create(mappedData);
};

// Actualizar una reserva
const updateReservation = async (id, updateData) => {
  const reservation = await CourtReservation.findByPk(id);
  if (!reservation) throw new Error('Reserva no encontrada');
  
  const mappedData = { ...updateData };
  
  // Mapear camelCase a snake_case si existen
  if (updateData.courtId) mappedData.court_id = updateData.courtId;
  if (updateData.userId) mappedData.user_id = updateData.userId;
  if (updateData.slotId) mappedData.slot_id = updateData.slotId;
  if (updateData.scheduledDate) mappedData.scheduled_date = updateData.scheduledDate;
  if (updateData.scheduledDateTime) mappedData.scheduled_date_time = updateData.scheduledDateTime;
  if (updateData.endDateTime) mappedData.end_date_time = updateData.endDateTime;

  return await reservation.update(mappedData);
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