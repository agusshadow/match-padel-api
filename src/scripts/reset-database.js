import { sequelize } from '../config/connection.js';
import { execSync } from 'child_process';

async function resetDatabase() {
  try {
    console.log('🔄 Limpiando tabla de migraciones...');
    
    await sequelize.query('DELETE FROM "SequelizeMeta"');
    console.log('✅ Tabla de migraciones limpiada');
    
    await sequelize.close();
    
    console.log('🔄 Ejecutando todas las migraciones...');
    execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
    
    console.log('🔄 Ejecutando todos los seeders...');
    execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit' });
    
    console.log('✅ Base de datos reseteada y seeders ejecutados correctamente');
  } catch (error) {
    console.error('❌ Error al resetear la base de datos:', error);
    process.exit(1);
  }
}

resetDatabase();

