import cron from 'node-cron';
import User from '../models/User.js';
import {
  assignDailyChallenges,
  assignWeeklyChallenges,
  assignMonthlyChallenges,
  cleanupExpiredChallenges
} from '../services/challengeService.js';

let dailyJob = null;
let weeklyJob = null;
let monthlyJob = null;
let cleanupJob = null;

/**
 * Iniciar job de asignación de desafíos diarios
 * Se ejecuta cada día a las 00:00
 */
const startDailyChallengesJob = () => {
  if (dailyJob) {
    console.log('⚠️ El job de desafíos diarios ya está corriendo');
    return;
  }

  // Ejecutar cada día a las 00:00
  dailyJob = cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos diarios...');
      
      // Obtener todos los usuarios activos
      const users = await User.findAll();
      
      let assignedCount = 0;
      for (const user of users) {
        const assigned = await assignDailyChallenges(user.id);
        assignedCount += assigned.length;
      }
      
      console.log(`✅ Desafíos diarios asignados: ${assignedCount} desafíos a ${users.length} usuarios`);
    } catch (error) {
      console.error('❌ Error en job de desafíos diarios:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Job de desafíos diarios iniciado (cada día a las 00:00)');
};

/**
 * Iniciar job de asignación de desafíos semanales
 * Se ejecuta cada lunes a las 00:00
 */
const startWeeklyChallengesJob = () => {
  if (weeklyJob) {
    console.log('⚠️ El job de desafíos semanales ya está corriendo');
    return;
  }

  // Ejecutar cada lunes a las 00:00
  weeklyJob = cron.schedule('0 0 * * 1', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos semanales...');
      
      // Obtener todos los usuarios activos
      const users = await User.findAll();
      
      let assignedCount = 0;
      for (const user of users) {
        const assigned = await assignWeeklyChallenges(user.id);
        assignedCount += assigned.length;
      }
      
      console.log(`✅ Desafíos semanales asignados: ${assignedCount} desafíos a ${users.length} usuarios`);
    } catch (error) {
      console.error('❌ Error en job de desafíos semanales:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Job de desafíos semanales iniciado (cada lunes a las 00:00)');
};

/**
 * Iniciar job de asignación de desafíos mensuales
 * Se ejecuta el día 1 de cada mes a las 00:00
 */
const startMonthlyChallengesJob = () => {
  if (monthlyJob) {
    console.log('⚠️ El job de desafíos mensuales ya está corriendo');
    return;
  }

  // Ejecutar el día 1 de cada mes a las 00:00
  monthlyJob = cron.schedule('0 0 1 * *', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos mensuales...');
      
      // Obtener todos los usuarios activos
      const users = await User.findAll();
      
      let assignedCount = 0;
      for (const user of users) {
        const assigned = await assignMonthlyChallenges(user.id);
        assignedCount += assigned.length;
      }
      
      console.log(`✅ Desafíos mensuales asignados: ${assignedCount} desafíos a ${users.length} usuarios`);
    } catch (error) {
      console.error('❌ Error en job de desafíos mensuales:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Job de desafíos mensuales iniciado (día 1 de cada mes a las 00:00)');
};

/**
 * Iniciar job de limpieza de desafíos expirados
 * Se ejecuta cada hora
 */
const startCleanupJob = () => {
  if (cleanupJob) {
    console.log('⚠️ El job de limpieza de desafíos ya está corriendo');
    return;
  }

  // Ejecutar cada hora
  cleanupJob = cron.schedule('0 * * * *', async () => {
    try {
      console.log('🔄 Limpiando desafíos expirados...');
      const updated = await cleanupExpiredChallenges();
      if (updated > 0) {
        console.log(`✅ ${updated} desafíos marcados como expirados`);
      }
    } catch (error) {
      console.error('❌ Error en job de limpieza de desafíos:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Job de limpieza de desafíos iniciado (cada hora)');
};

/**
 * Iniciar todos los jobs de desafíos
 */
const startChallengeJobs = () => {
  startDailyChallengesJob();
  startWeeklyChallengesJob();
  startMonthlyChallengesJob();
  startCleanupJob();
};

/**
 * Detener todos los jobs de desafíos
 */
const stopChallengeJobs = () => {
  if (dailyJob) {
    dailyJob.stop();
    dailyJob = null;
    console.log('⏹️ Job de desafíos diarios detenido');
  }
  
  if (weeklyJob) {
    weeklyJob.stop();
    weeklyJob = null;
    console.log('⏹️ Job de desafíos semanales detenido');
  }
  
  if (monthlyJob) {
    monthlyJob.stop();
    monthlyJob = null;
    console.log('⏹️ Job de desafíos mensuales detenido');
  }
  
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    console.log('⏹️ Job de limpieza de desafíos detenido');
  }
};

export {
  startChallengeJobs,
  stopChallengeJobs,
  startDailyChallengesJob,
  startWeeklyChallengesJob,
  startMonthlyChallengesJob,
  startCleanupJob
};

