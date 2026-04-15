import Match from '../models/Match.js';
import MatchParticipant from '../models/MatchParticipant.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/connection.js';

/**
 * Cancelar partidos que ya pasaron la fecha y no tienen los 4 jugadores llenos
 */
const cancelExpiredIncompleteMatches = async () => {
  try {
    const now = new Date();
    
    // Encontrar IDs de partidos que ya pasaron y no están llenos
    // Un partido está lleno si tiene 4 participantes
    const incompleteMatchIds = await Match.findAll({
      attributes: ['id'],
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        match_date_time: { [Op.lt]: now }
      },
      include: [{
        model: MatchParticipant,
        as: 'participants',
        attributes: []
      }],
      group: ['Match.id'],
      having: sequelize.where(sequelize.fn('COUNT', sequelize.col('participants.id')), { [Op.lt]: 4 }),
      raw: true
    });

    const ids = incompleteMatchIds.map(m => m.id);

    if (ids.length === 0) {
      return { cancelledCount: 0, message: '0 partidos cancelados' };
    }

    const [cancelledCount] = await Match.update(
      {
        status: Match.MATCH_STATUS.CANCELLED,
        cancelled_at: now
      },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

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
    
    // Encontrar IDs de partidos que deben iniciar (están llenos y es la hora)
    const readyMatchIds = await Match.findAll({
      attributes: ['id'],
      where: {
        status: Match.MATCH_STATUS.SCHEDULED,
        match_date_time: { [Op.lte]: now }
      },
      include: [{
        model: MatchParticipant,
        as: 'participants',
        attributes: []
      }],
      group: ['Match.id'],
      having: sequelize.where(sequelize.fn('COUNT', sequelize.col('participants.id')), 4),
      raw: true
    });

    const ids = readyMatchIds.map(m => m.id);

    if (ids.length === 0) {
      return { startedCount: 0, message: '0 partidos iniciados' };
    }

    const [startedCount] = await Match.update(
      {
        status: Match.MATCH_STATUS.IN_PROGRESS,
        started_at: now
      },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

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
    
    const [finishedCount] = await Match.update(
      {
        status: Match.MATCH_STATUS.PENDING_CONFIRMATION,
        finished_at: now
      },
      {
        where: {
          status: Match.MATCH_STATUS.IN_PROGRESS,
          match_end_date_time: { 
            [Op.lt]: now,
            [Op.not]: null
          }
        }
      }
    );

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
