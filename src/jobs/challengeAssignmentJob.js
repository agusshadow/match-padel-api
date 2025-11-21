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

const startDailyChallengesJob = () => {
  if (dailyJob) {
    console.log('⚠️ El job de desafíos diarios ya está corriendo');
    return;
  }

  dailyJob = cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos diarios...');
      
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

const startWeeklyChallengesJob = () => {
  if (weeklyJob) {
    console.log('⚠️ El job de desafíos semanales ya está corriendo');
    return;
  }

  weeklyJob = cron.schedule('0 0 * * 1', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos semanales...');
      
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

const startMonthlyChallengesJob = () => {
  if (monthlyJob) {
    console.log('⚠️ El job de desafíos mensuales ya está corriendo');
    return;
  }

  monthlyJob = cron.schedule('0 0 1 * *', async () => {
    try {
      console.log('🔄 Iniciando asignación de desafíos mensuales...');
      
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

const startCleanupJob = () => {
  if (cleanupJob) {
    console.log('⚠️ El job de limpieza de desafíos ya está corriendo');
    return;
  }

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

const runInitialChallengeAssignment = async () => {
  try {
    console.log('🔄 Ejecutando asignación inicial de desafíos...');
    
    const cleaned = await cleanupExpiredChallenges();
    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} desafíos expirados limpiados`);
    }
    
    // Obtener todos los usuarios activos
    const users = await User.findAll();
    
    let dailyAssigned = 0;
    let weeklyAssigned = 0;
    let monthlyAssigned = 0;
    
    for (const user of users) {
      // Asignar desafíos diarios si no tiene activos del día actual
      const daily = await assignDailyChallenges(user.id);
      dailyAssigned += daily.length;
      
      // Asignar desafíos semanales si no tiene activos de la semana actual
      const weekly = await assignWeeklyChallenges(user.id);
      weeklyAssigned += weekly.length;
      
      // Asignar desafíos mensuales si no tiene activos del mes actual
      const monthly = await assignMonthlyChallenges(user.id);
      monthlyAssigned += monthly.length;
    }
    
    console.log(`✅ Asignación inicial completada:`);
    console.log(`   - Desafíos diarios: ${dailyAssigned} asignados a ${users.length} usuarios`);
    console.log(`   - Desafíos semanales: ${weeklyAssigned} asignados a ${users.length} usuarios`);
    console.log(`   - Desafíos mensuales: ${monthlyAssigned} asignados a ${users.length} usuarios`);
  } catch (error) {
    console.error('❌ Error en asignación inicial de desafíos:', error);
  }
};

const startChallengeJobs = async () => {
  await runInitialChallengeAssignment();
  
  startDailyChallengesJob();
  startWeeklyChallengesJob();
  startMonthlyChallengesJob();
  startCleanupJob();
};

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

const runChallengeAssignment = async () => {
  try {
    console.log('🔄 Ejecutando asignación de desafíos (trigger externo)...');
    
    const cleaned = await cleanupExpiredChallenges();
    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} desafíos expirados limpiados`);
    }
    
    // Obtener todos los usuarios activos
    const users = await User.findAll();
    
    let dailyAssigned = 0;
    let weeklyAssigned = 0;
    let monthlyAssigned = 0;
    
    for (const user of users) {
      // Asignar desafíos diarios si no tiene activos del día actual
      const daily = await assignDailyChallenges(user.id);
      dailyAssigned += daily.length;
      
      // Asignar desafíos semanales si no tiene activos de la semana actual
      const weekly = await assignWeeklyChallenges(user.id);
      weeklyAssigned += weekly.length;
      
      // Asignar desafíos mensuales si no tiene activos del mes actual
      const monthly = await assignMonthlyChallenges(user.id);
      monthlyAssigned += monthly.length;
    }
    
    const result = {
      success: true,
      cleaned,
      users: users.length,
      dailyAssigned,
      weeklyAssigned,
      monthlyAssigned,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Asignación de desafíos completada:`, result);
    return result;
  } catch (error) {
    console.error('❌ Error en asignación de desafíos:', error);
    throw error;
  }
};

export {
  startChallengeJobs,
  stopChallengeJobs,
  startDailyChallengesJob,
  startWeeklyChallengesJob,
  startMonthlyChallengesJob,
  startCleanupJob,
  runChallengeAssignment
};

