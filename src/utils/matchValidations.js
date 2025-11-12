import CourtReservation from '../models/CourtReservation.js';
import { Op } from 'sequelize';

/**
 * Combina fecha y hora para obtener un Date completo
 * @param {string|Date} scheduledDate - Fecha en formato 'YYYY-MM-DD' o objeto Date
 * @param {string} startTime - Hora en formato 'HH:mm:ss' o 'HH:mm'
 * @returns {Date} Fecha/hora combinada en zona horaria local
 */
const combineDateAndTime = (scheduledDate, startTime) => {
  let year, month, day;
  
  // Manejar tanto string como Date
  if (scheduledDate instanceof Date) {
    year = scheduledDate.getFullYear();
    month = scheduledDate.getMonth();
    day = scheduledDate.getDate();
  } else {
    // Parsear string 'YYYY-MM-DD'
    [year, month, day] = scheduledDate.split('-').map(Number);
    month = month - 1; // Los meses en JS son 0-indexed
  }
  
  // Parsear hora
  const [hours, minutes, seconds = 0] = startTime.split(':').map(Number);
  
  return new Date(year, month, day, hours, minutes, seconds, 0);
};

/**
 * Valida la creación de un partido
 * @param {string} scheduledDate - Fecha programada en formato 'YYYY-MM-DD'
 * @param {Object} slot - Objeto CourtSlot con startTime y dayOfWeek
 * @param {number} slotId - ID del slot
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
const validateMatchCreation = async (scheduledDate, slot, slotId) => {
  const errors = [];
  const now = new Date();

  // 1. Validar que la fecha no sea en el pasado
  const matchDateTime = combineDateAndTime(scheduledDate, slot.startTime);
  if (matchDateTime < now) {
    errors.push('No se puede crear un partido en el pasado');
  }

  // 2. Validar que el slot coincida con el día de la semana de la fecha
  const matchDay = matchDateTime.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  if (slot.dayOfWeek !== matchDay) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    errors.push(
      `El slot está configurado para ${days[slot.dayOfWeek]} pero la fecha seleccionada es ${days[matchDay]}`
    );
  }

  // 3. Validar que el slot esté disponible
  if (!slot.isAvailable) {
    errors.push('El slot seleccionado no está disponible');
  }

  // 4. Validar que no haya otra reserva activa para ese slot en esa fecha
  const existingReservation = await CourtReservation.findOne({
    where: {
      slotId: slotId,
      scheduledDate: scheduledDate,
      status: {
        [Op.notIn]: ['cancelled', 'completed']
      }
    }
  });

  if (existingReservation) {
    errors.push('Ya existe una reserva activa para este slot en la fecha seleccionada');
  }

  // 5. Validar que la fecha no sea muy lejana (opcional: máximo 1 año)
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (matchDateTime > oneYearFromNow) {
    errors.push('No se pueden crear partidos con más de 1 año de anticipación');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export { validateMatchCreation, combineDateAndTime };

