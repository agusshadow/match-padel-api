import dotenv from 'dotenv';
import { sequelize } from '../config/connection.js';
import { runChallengeAssignment } from '../jobs/challengeAssignmentJob.js';
import '../models/associations.js';

dotenv.config();

const runScript = async () => {
  try {
    console.log('🚀 Iniciando asignación manual de desafíos...\n');
    
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');
    
    const result = await runChallengeAssignment();
    
    console.log('\n✅ Script completado exitosamente');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error ejecutando el script:', error);
    await sequelize.close();
    process.exit(1);
  }
};

runScript();

