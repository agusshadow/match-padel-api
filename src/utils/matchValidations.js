import CourtReservation from '../models/CourtReservation.js';
import { Op } from 'sequelize';

const combineDateAndTime = (scheduledDate, startTime) => {
  let year, month, day;
  
  if (scheduledDate instanceof Date) {
    year = scheduledDate.getFullYear();
    month = scheduledDate.getMonth();
    day = scheduledDate.getDate();
  } else {
    [year, month, day] = scheduledDate.split('-').map(Number);
    month = month - 1;
  }
  
  const [hours, minutes, seconds = 0] = startTime.split(':').map(Number);
  
  return new Date(year, month, day, hours, minutes, seconds, 0);
};

const validateMatchCreation = async (scheduledDate, slot, slotId) => {
  const errors = [];
  const now = new Date();

  const matchDateTime = combineDateAndTime(scheduledDate, slot.start_time);
  if (matchDateTime < now) {
    errors.push('No se puede crear un partido en el pasado');
  }

  const matchDay = matchDateTime.getDay();
  if (slot.day_of_week !== matchDay) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    errors.push(
      `El slot está configurado para ${days[slot.day_of_week]} pero la fecha seleccionada es ${days[matchDay]}`
    );
  }

  if (!slot.is_available) {
    errors.push('El slot seleccionado no está disponible');
  }

  const existingReservation = await CourtReservation.findOne({
    where: {
      slot_id: slotId,
      scheduled_date: scheduledDate,
      status: {
        [Op.notIn]: ['cancelled', 'completed']
      }
    }
  });

  if (existingReservation) {
    errors.push('Ya existe una reserva activa para este slot en la fecha seleccionada');
  }

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

