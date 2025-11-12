import Match from '../models/Match.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/connection.js';

/**
 * Cancelar partidos que ya pasaron la fecha y no tienen los 4 slots llenos
 * ⭐ Simplificado: Usa campos denormalizados y actualización masiva
 */
const cancelExpiredIncompleteMatches = async () => {
  try {
    const now = new Date();
    
    // Actualizar directamente con bulkUpdate (más eficiente)
    // Usamos una subquery SQL para actualizar cancelledBy = createdBy
    const [cancelledCount] = await sequelize.query(`
      UPDATE matches 
      SET 
        status = 'cancelled',
        "cancelledAt" = :now,
        "cancelledBy" = "createdBy"
      WHERE status = 'scheduled'
        AND "matchDateTime" < :now
        AND "matchDateTime" IS NOT NULL
        AND (
          "team1Player2Id" IS NULL 
          OR "team2Player1Id" IS NULL 
          OR "team2Player2Id" IS NULL
        )
    `, {
      replacements: { now },
      type: sequelize.QueryTypes.UPDATE
    });

    return { cancelledCount, message: `${cancelledCount} partidos cancelados` };
  } catch (error) {
    console.error('❌ Error cancelando partidos vencidos:', error);
    throw error;
  }
};

/**
 * Iniciar partidos automáticamente cuando llegue la fecha y hora del partido
 * ⭐ Simplificado: Usa campos denormalizados y actualización masiva
 */
const startScheduledMatches = async () => {
  try {
    const now = new Date();
    
    // Actualizar directamente con bulkUpdate (más eficiente)
    const [startedCount] = await Match.update(
      {
        status: Match.MATCH_STATUS.IN_PROGRESS,
        startedAt: now
      },
      {
        where: {
          status: Match.MATCH_STATUS.SCHEDULED,
          matchDateTime: { 
            [Op.lte]: now,
            [Op.not]: null
          },
          // Partido completo: todos los jugadores deben estar asignados
          team1Player1Id: { [Op.ne]: null },
          team1Player2Id: { [Op.ne]: null },
          team2Player1Id: { [Op.ne]: null },
          team2Player2Id: { [Op.ne]: null }
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
 * ⭐ Simplificado: Usa campo denormalizado matchEndDateTime y actualización masiva
 */
const finishInProgressMatches = async () => {
  try {
    const now = new Date();
    
    // Actualizar directamente con bulkUpdate (más eficiente)
    const [finishedCount] = await Match.update(
      {
        status: Match.MATCH_STATUS.PENDING_CONFIRMATION,
        finishedAt: now
      },
      {
        where: {
          status: Match.MATCH_STATUS.IN_PROGRESS,
          matchEndDateTime: { 
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

