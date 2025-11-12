import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { Op } from 'sequelize';

// Constante de duración del partido (90 minutos)
const MATCH_DURATION_MINUTES = 90;

/**
 * Helper para verificar si un partido tiene los 4 slots llenos
 */
const isMatchFull = (match) => {
  return match.team1Player1Id !== null &&
         match.team1Player2Id !== null &&
         match.team2Player1Id !== null &&
         match.team2Player2Id !== null;
};

/**
 * Helper para combinar fecha (DATEONLY) con hora (TIME) y obtener un Date completo
 * Maneja correctamente las zonas horarias usando la hora local
 */
const combineDateAndTime = (dateOnly, timeString) => {
  // dateOnly puede ser un string 'YYYY-MM-DD' o un objeto Date
  // timeString es un string 'HH:mm:ss' o 'HH:mm' (formato TIME de PostgreSQL)
  
  // Normalizar la fecha - extraer año, mes y día
  let year, month, day;
  if (dateOnly instanceof Date) {
    year = dateOnly.getFullYear();
    month = dateOnly.getMonth();
    day = dateOnly.getDate();
  } else if (typeof dateOnly === 'string') {
    // Parsear string 'YYYY-MM-DD'
    const dateParts = dateOnly.split('-');
    year = parseInt(dateParts[0], 10);
    month = parseInt(dateParts[1], 10) - 1; // Los meses en JS son 0-indexed
    day = parseInt(dateParts[2], 10);
  } else {
    const tempDate = new Date(dateOnly);
    year = tempDate.getFullYear();
    month = tempDate.getMonth();
    day = tempDate.getDate();
  }
  
  // Normalizar timeString (puede venir como string o Date)
  let timeStr = timeString;
  if (timeString instanceof Date) {
    // Si es Date, extraer solo la hora
    timeStr = timeString.toTimeString().split(' ')[0]; // 'HH:mm:ss'
  } else if (typeof timeString !== 'string') {
    timeStr = String(timeString);
  }
  
  // Extraer hora, minutos y segundos del timeString
  const timeParts = timeStr.split(':');
  const hours = parseInt(timeParts[0] || 0, 10);
  const minutes = parseInt(timeParts[1] || 0, 10);
  const seconds = parseInt(timeParts[2] || 0, 10);
  
  // Crear nueva fecha usando el constructor Date con año, mes, día, hora, minuto, segundo
  // Esto crea la fecha en la zona horaria local
  const combinedDate = new Date(year, month, day, hours, minutes, seconds, 0);
  
  return combinedDate;
};

/**
 * Cancelar partidos que ya pasaron la fecha y no tienen los 4 slots llenos
 */
const cancelExpiredIncompleteMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos scheduled que:
    // 1. La fecha/hora del partido ya pasó
    // 2. No tienen los 4 slots llenos
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        [Op.or]: [
          { team1Player2Id: null },
          { team2Player1Id: null },
          { team2Player2Id: null }
        ]
      },
      include: [
        {
          association: 'reservation',
          required: true,
          include: [
            {
              association: 'slot',
              required: true
            }
          ]
        }
      ]
    });

    let cancelledCount = 0;

    for (const match of matches) {
      const reservation = match.reservation;
      const slot = reservation.slot;
      
      if (!reservation || !slot) {
        console.log(`⚠️ Partido ${match.id}: No tiene reserva o slot asociado`);
        continue;
      }

      // Combinar fecha y hora para obtener la fecha/hora completa del partido
      const matchDateTime = combineDateAndTime(
        reservation.scheduledDate,
        slot.startTime
      );

      // Si la fecha/hora del partido ya pasó
      if (matchDateTime < now) {
        await match.update({ status: Match.MATCH_STATUS.CANCELLED });
        cancelledCount++;
        console.log(`✅ Partido ${match.id} cancelado (fecha/hora pasada sin completar slots)`);
      }
    }

    return { cancelledCount, message: `${cancelledCount} partidos cancelados` };
  } catch (error) {
    console.error('❌ Error cancelando partidos vencidos:', error);
    throw error;
  }
};

/**
 * Iniciar partidos automáticamente cuando llegue la fecha y hora del partido
 */
const startScheduledMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos scheduled que:
    // 1. Tienen los 4 slots llenos
    // 2. La fecha/hora del partido ya llegó o pasó
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        team1Player1Id: { [Op.ne]: null },
        team1Player2Id: { [Op.ne]: null },
        team2Player1Id: { [Op.ne]: null },
        team2Player2Id: { [Op.ne]: null }
      },
      include: [
        {
          association: 'reservation',
          required: true,
          include: [
            {
              association: 'slot',
              required: true
            }
          ]
        }
      ]
    });

    let startedCount = 0;

    for (const match of matches) {
      const reservation = match.reservation;
      const slot = reservation.slot;
      
      if (!reservation || !slot) {
        continue;
      }

      // Combinar fecha y hora para obtener la fecha/hora completa del partido
      const matchDateTime = combineDateAndTime(
        reservation.scheduledDate,
        slot.startTime
      );

      // Si la fecha/hora del partido ya llegó o pasó
      if (matchDateTime <= now) {
        await match.update({ status: Match.MATCH_STATUS.IN_PROGRESS });
        startedCount++;
        console.log(`✅ Partido ${match.id} iniciado automáticamente`);
      }
    }

    return { startedCount, message: `${startedCount} partidos iniciados` };
  } catch (error) {
    console.error('❌ Error iniciando partidos:', error);
    throw error;
  }
};

/**
 * Finalizar partidos automáticamente cuando termine la duración del partido
 */
const finishInProgressMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos in_progress
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.IN_PROGRESS
      },
      include: [
        {
          association: 'reservation',
          required: true,
          include: [
            {
              association: 'slot',
              required: true
            }
          ]
        }
      ]
    });

    let finishedCount = 0;

    for (const match of matches) {
      const reservation = match.reservation;
      const slot = reservation.slot;
      
      if (!reservation || !slot) {
        continue;
      }

      // Combinar fecha y hora para obtener la fecha/hora de inicio
      const matchStartDateTime = combineDateAndTime(
        reservation.scheduledDate,
        slot.startTime
      );

      // Calcular fecha/hora de finalización (inicio + 90 minutos)
      const matchEndDateTime = new Date(matchStartDateTime);
      matchEndDateTime.setMinutes(matchEndDateTime.getMinutes() + MATCH_DURATION_MINUTES);

      // Si la fecha/hora de finalización ya pasó
      if (matchEndDateTime < now) {
        await match.update({ status: Match.MATCH_STATUS.PENDING_CONFIRMATION });
        finishedCount++;
        console.log(`✅ Partido ${match.id} finalizado automáticamente`);
      }
    }

    return { finishedCount, message: `${finishedCount} partidos finalizados` };
  } catch (error) {
    console.error('❌ Error finalizando partidos:', error);
    throw error;
  }
};

/**
 * Ejecutar todas las actualizaciones de estado de partidos
 */
const updateMatchStatuses = async () => {
  try {
    console.log('🔄 Iniciando actualización de estados de partidos...');
    
    const results = {
      cancelled: await cancelExpiredIncompleteMatches(),
      started: await startScheduledMatches(),
      finished: await finishInProgressMatches()
    };

    console.log('✅ Actualización de estados completada:', results);
    return results;
  } catch (error) {
    console.error('❌ Error en actualización de estados:', error);
    throw error;
  }
};

export {
  cancelExpiredIncompleteMatches,
  startScheduledMatches,
  finishInProgressMatches,
  updateMatchStatuses
};

