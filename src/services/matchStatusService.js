import Match from '../models/Match.js';
import { Op } from 'sequelize';

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
 * Cancelar partidos que ya pasaron la fecha y no tienen los 4 slots llenos
 * ⭐ Optimizado: Usa campo denormalizado matchDateTime
 */
const cancelExpiredIncompleteMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos scheduled que:
    // 1. La fecha/hora del partido ya pasó (usando campo denormalizado)
    // 2. No tienen los 4 slots llenos
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        matchDateTime: { [Op.lt]: now }, // ⭐ Usa campo denormalizado
        [Op.or]: [
          { team1Player2Id: null },
          { team2Player1Id: null },
          { team2Player2Id: null }
        ]
      }
    });

    let cancelledCount = 0;

    for (const match of matches) {
      await match.update({ 
        status: Match.MATCH_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: match.createdBy // El creador cancela automáticamente
      });
      cancelledCount++;
      console.log(`✅ Partido ${match.id} cancelado (fecha/hora pasada sin completar slots)`);
    }

    return { cancelledCount, message: `${cancelledCount} partidos cancelados` };
  } catch (error) {
    console.error('❌ Error cancelando partidos vencidos:', error);
    throw error;
  }
};

/**
 * Iniciar partidos automáticamente cuando llegue la fecha y hora del partido
 * ⭐ Optimizado: Usa campo denormalizado matchDateTime
 */
const startScheduledMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos scheduled que:
    // 1. Tienen los 4 slots llenos
    // 2. La fecha/hora del partido ya llegó o pasó (usando campo denormalizado)
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        matchDateTime: { [Op.lte]: now }, // ⭐ Usa campo denormalizado
        team1Player1Id: { [Op.ne]: null },
        team1Player2Id: { [Op.ne]: null },
        team2Player1Id: { [Op.ne]: null },
        team2Player2Id: { [Op.ne]: null }
      }
    });

    let startedCount = 0;

    for (const match of matches) {
      await match.update({ 
        status: Match.MATCH_STATUS.IN_PROGRESS,
        startedAt: new Date()
      });
      startedCount++;
      console.log(`✅ Partido ${match.id} iniciado automáticamente`);
    }

    return { startedCount, message: `${startedCount} partidos iniciados` };
  } catch (error) {
    console.error('❌ Error iniciando partidos:', error);
    throw error;
  }
};

/**
 * Finalizar partidos automáticamente cuando termine la duración del partido
 * ⭐ Optimizado: Usa campo denormalizado matchEndDateTime
 */
const finishInProgressMatches = async () => {
  try {
    const now = new Date();
    
    // Buscar partidos in_progress cuya fecha/hora de finalización ya pasó
    const matches = await Match.findAll({
      where: {
        status: Match.MATCH_STATUS.IN_PROGRESS,
        matchEndDateTime: { [Op.lt]: now } // ⭐ Usa campo denormalizado
      }
    });

    let finishedCount = 0;

    for (const match of matches) {
      await match.update({ 
        status: Match.MATCH_STATUS.PENDING_CONFIRMATION,
        finishedAt: new Date()
      });
      finishedCount++;
      console.log(`✅ Partido ${match.id} finalizado automáticamente`);
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

