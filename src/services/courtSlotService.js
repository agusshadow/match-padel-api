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

// Obtener slots disponibles por cancha y día de semana (método antiguo - mantener por compatibilidad)
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

// ⭐ NUEVO: Obtener slots disponibles por cancha y fecha específica
const getAvailableSlotsByCourtAndDate = async (courtId, date) => {
  const { combineDateAndTime } = await import('../utils/matchValidations.js');
  const CourtReservation = (await import('../models/CourtReservation.js')).default;
  const { Op } = await import('sequelize');
  
  // 1. Obtener día de semana de la fecha (parsear directamente para evitar problemas de zona horaria)
  // Formato: 'YYYY-MM-DD'
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // month - 1 porque JS usa 0-indexed
  const dayOfWeek = dateObj.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  
  // 2. Obtener slots de la cancha para ese día de semana que estén disponibles
  const slots = await CourtSlot.findAll({
    where: { 
      courtId,
      dayOfWeek,
      isAvailable: true // Filtro de admin
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

  // 3. Obtener reservas activas para esa fecha
  const reservations = await CourtReservation.findAll({
    where: {
      scheduledDate: date,
      status: {
        [Op.notIn]: ['cancelled', 'completed']
      }
    }
  });

  const reservedSlotIds = new Set(reservations.map(r => r.slotId).filter(Boolean));

  // 4. Filtrar slots: excluir reservados y verificar que la hora no haya pasado
  const now = new Date();
  const availableSlots = [];

  for (const slot of slots) {
    // Verificar si está reservado
    if (reservedSlotIds.has(slot.id)) {
      continue;
    }

    // Combinar fecha y hora para verificar si ya pasó
    const slotDateTime = combineDateAndTime(date, slot.startTime);
    
    // Excluir si la hora ya pasó
    if (slotDateTime < now) {
      continue;
    }

    // Agregar información adicional
    const slotData = slot.toJSON();
    slotData.availableDateTime = slotDateTime.toISOString();
    slotData.isAvailable = true;
    
    availableSlots.push(slotData);
  }

  return availableSlots;
};

export {
  getAllSlots,
  getSlotsByCourt,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  getAvailableSlotsByCourtAndDay,
  getAvailableSlotsByCourtAndDate
};