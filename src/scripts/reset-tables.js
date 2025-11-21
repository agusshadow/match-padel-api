import { sequelize } from '../config/connection.js';
import { execSync } from 'child_process';

async function resetTables() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    console.log('🔄 Obteniendo lista de tablas...');
    const [tables] = await sequelize.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename != 'SequelizeMeta'
      ORDER BY tablename;
    `);

    if (tables.length === 0) {
      console.log('⚠️ No hay tablas para eliminar');
    } else {
      console.log(`🔄 Eliminando ${tables.length} tablas...`);
      
      const tableNames = tables.map(t => t.tablename);
      
      const orderedTables = [
        'match_score_sets',
        'match_scores',
        'matches',
        'user_challenges',
        'court_reservations',
        'user_experience',
        'notifications',
        'user_levels',
        'user_profiles',
        'court_slots',
        'courts',
        'cosmetics',
        'challenges',
        'clubs',
        'users'
      ].filter(name => tableNames.includes(name));

      for (const tableName of orderedTables) {
        try {
          console.log(`  🗑️  Eliminando tabla: ${tableName}`);
          await sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        } catch (error) {
          console.log(`  ⚠️  Error al eliminar ${tableName}: ${error.message}`);
        }
      }

      const remainingTables = tableNames.filter(name => !orderedTables.includes(name));
      for (const tableName of remainingTables) {
        try {
          console.log(`  🗑️  Eliminando tabla: ${tableName}`);
          await sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        } catch (error) {
          console.log(`  ⚠️  Error al eliminar ${tableName}: ${error.message}`);
        }
      }

      console.log('✅ Todas las tablas eliminadas');
    }

    console.log('🔄 Limpiando tabla de migraciones...');
    try {
      await sequelize.query('DELETE FROM "SequelizeMeta";');
      console.log('✅ Tabla de migraciones limpiada');
    } catch (error) {
      console.log('⚠️ No se pudo limpiar SequelizeMeta (puede que no exista)');
    }

    await sequelize.close();

    console.log('🔄 Ejecutando migraciones...');
    execSync('npm run db:migrate', { stdio: 'inherit' });
    console.log('✅ Migraciones ejecutadas');

    console.log('🔄 Ejecutando seeders...');
    execSync('npm run db:seed', { stdio: 'inherit' });
    console.log('✅ Seeders ejecutados');

    console.log('✅ Base de datos reseteada completamente');
  } catch (error) {
    console.error('❌ Error al resetear las tablas:', error.message);
    process.exit(1);
  }
}

resetTables();

