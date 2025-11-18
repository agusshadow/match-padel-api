'use strict';

/** @type {import('sequelize-cli').Migration} */
// Esta migración limpia la tabla de migraciones para empezar desde cero
// Ejecutar manualmente: npm run db:migrate
module.exports = {
  async up (queryInterface, Sequelize) {
    // Limpiar todas las migraciones antiguas
    await queryInterface.sequelize.query('DELETE FROM "SequelizeMeta"');
    console.log('✅ Tabla de migraciones limpiada');
    
    // Insertar solo las nuevas migraciones
    const newMigrations = [
      '20250101000001-create-users.cjs',
      '20250101000002-create-clubs.cjs',
      '20250101000003-create-courts.cjs',
      '20250101000004-create-court-slots.cjs',
      '20250101000005-create-user-profiles.cjs',
      '20250101000006-create-user-levels.cjs',
      '20250101000007-create-user-experience.cjs',
      '20250101000008-create-notifications.cjs',
      '20250101000009-create-court-reservations.cjs',
      '20250101000010-create-matches.cjs',
      '20250101000011-create-match-scores.cjs',
      '20250101000012-create-match-score-sets.cjs'
    ];

    for (const migration of newMigrations) {
      await queryInterface.sequelize.query(
        `INSERT INTO "SequelizeMeta" (name) VALUES ('${migration}') ON CONFLICT DO NOTHING`
      );
    }
    
    console.log(`✅ ${newMigrations.length} migraciones registradas`);
  },

  async down (queryInterface, Sequelize) {
    // No hacer nada en el down
  }
};

