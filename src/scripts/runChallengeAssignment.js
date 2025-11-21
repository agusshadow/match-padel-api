import dotenv from 'dotenv';
import { sequelize } from '../config/connection.js';
import { runChallengeAssignment } from '../jobs/challengeAssignmentJob.js';
import '../models/associations.js';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para ejecutar la asignación de desafíos manualmente
 * Uso: npm run challenges:assign
 */
const runScript = async () => {
  try {
    console.log('🚀 Iniciando asignación manual de desafíos...\n');
    
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');
    
    // Ejecutar asignación de desafíos
    const result = await runChallengeAssignment();
    
    console.log('\n✅ Script completado exitosamente');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    // Cerrar conexión
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error ejecutando el script:', error);
    await sequelize.close();
    process.exit(1);
  }
};

runScript();

