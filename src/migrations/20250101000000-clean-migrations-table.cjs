'use strict';

/** @type {import('sequelize-cli').Migration} */
// Esta migración limpia la tabla de migraciones para empezar desde cero
// Ejecutar manualmente: npm run db:migrate
module.exports = {
  async up (queryInterface, Sequelize) {
    // Limpiar todas las migraciones antiguas
    await queryInterface.sequelize.query('DELETE FROM "SequelizeMeta"');
    console.log('✅ Tabla de migraciones limpiada');
    
    // NO marcar migraciones como ejecutadas - dejar que se ejecuten normalmente
    // Las migraciones se ejecutarán en orden y se registrarán automáticamente
    console.log('✅ Listo para ejecutar migraciones');
  },

  async down (queryInterface, Sequelize) {
    // No hacer nada en el down
  }
};

