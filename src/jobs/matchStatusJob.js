import cron from 'node-cron';
import { updateMatchStatuses } from '../services/matchStatusService.js';

/**
 * Job programado para actualizar estados de partidos automáticamente
 * Se ejecuta cada 5 minutos
 */
let matchStatusJob = null;

/**
 * Iniciar el job de actualización de estados
 */
const startMatchStatusJob = () => {
  // Verificar si el job ya está corriendo
  if (matchStatusJob) {
    console.log('⚠️ El job de actualización de estados ya está corriendo');
    return;
  }

  // Ejecutar cada 5 minutos: '*/5 * * * *'
  // Formato cron: minuto hora día mes día-semana
  // '*/5 * * * *' = cada 5 minutos
  matchStatusJob = cron.schedule('*/5 * * * *', async () => {
    try {
      await updateMatchStatuses();
    } catch (error) {
      console.error('❌ Error en job de actualización de estados:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires' // Ajustar según tu zona horaria
  });

  console.log('✅ Job de actualización de estados iniciado (cada 5 minutos)');
};

/**
 * Detener el job de actualización de estados
 */
const stopMatchStatusJob = () => {
  if (matchStatusJob) {
    matchStatusJob.stop();
    matchStatusJob = null;
    console.log('⏹️ Job de actualización de estados detenido');
  }
};

/**
 * Ejecutar manualmente la actualización de estados (útil para testing)
 */
const runMatchStatusUpdate = async () => {
  try {
    await updateMatchStatuses();
  } catch (error) {
    console.error('❌ Error ejecutando actualización manual:', error);
    throw error;
  }
};

export {
  startMatchStatusJob,
  stopMatchStatusJob,
  runMatchStatusUpdate
};

