import CourtSlot from '../models/CourtSlot.js';

// Obtener todos los slots
const getAllSlots = async () => {
  return await CourtSlot.findAll();
};

// Obtener slots por cancha
const getSlotsByCourt = async (courtId) => {
  return await CourtSlot.findAll({
    where: { courtId },
    include: [
      {
        association: 'court',
        include: [
          {
            association: 'club'
          }
        ]
      }
    ]
  });
};

// Obtener un slot por ID
const getSlotById = async (id) => {
  return await CourtSlot.findByPk(id);
};

// Crear un nuevo slot
const createSlot = async (slotData) => {
  return await CourtSlot.create(slotData);
};

// Actualizar un slot
const updateSlot = async (id, updateData) => {
  const slot = await CourtSlot.findByPk(id);
  if (!slot) throw new Error('Slot no encontrado');
  return await slot.update(updateData);
};

// Eliminar un slot
const deleteSlot = async (id) => {
  const slot = await CourtSlot.findByPk(id);
  if (!slot) throw new Error('Slot no encontrado');
  return await slot.destroy();
};

// Obtener slots disponibles por cancha y día
const getAvailableSlotsByCourtAndDay = async (courtId, dayOfWeek) => {
  return await CourtSlot.findAll({
    where: { 
      courtId,
      dayOfWeek,
      isAvailable: true
    },
    include: [
      {
        association: 'court',
        include: [
          {
            association: 'club'
          }
        ]
      }
    ],
    order: [['startTime', 'ASC']]
  });
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