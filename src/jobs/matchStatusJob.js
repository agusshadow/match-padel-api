import cron from 'node-cron';
import { updateMatchStatuses } from '../services/matchStatusService.js';

let matchStatusJob = null;

const startMatchStatusJob = () => {
  if (matchStatusJob) {
    console.log('⚠️ El job de actualización de estados ya está corriendo');
    return;
  }

  matchStatusJob = cron.schedule('*/5 * * * *', async () => {
    try {
      await updateMatchStatuses();
    } catch (error) {
      console.error('❌ Error en job de actualización de estados:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Job de actualización de estados iniciado (cada 5 minutos)');
};

const stopMatchStatusJob = () => {
  if (matchStatusJob) {
    matchStatusJob.stop();
    matchStatusJob = null;
    console.log('⏹️ Job de actualización de estados detenido');
  }
};

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

