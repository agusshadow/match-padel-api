'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Renombrar la tabla de court_schedules a court_slots
    await queryInterface.renameTable('court_schedules', 'court_slots');
    console.log('Tabla renombrada de court_schedules a court_slots');
  },

  async down (queryInterface, Sequelize) {
    // Revertir el cambio: renombrar de court_slots a court_schedules
    await queryInterface.renameTable('court_slots', 'court_schedules');
    console.log('Tabla renombrada de court_slots a court_schedules');
  }
};
