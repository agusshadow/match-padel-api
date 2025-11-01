'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Modificar el ENUM para agregar 'pending_confirmation'
    // MySQL/MariaDB requiere especificar todos los valores del ENUM al modificarlo
    await queryInterface.sequelize.query(`
      ALTER TABLE matches 
      MODIFY COLUMN status ENUM('scheduled', 'in_progress', 'pending_confirmation', 'completed', 'cancelled') 
      NOT NULL DEFAULT 'scheduled'
    `);
  },

  async down (queryInterface, Sequelize) {
    // Revertir al ENUM original sin 'pending_confirmation'
    await queryInterface.sequelize.query(`
      ALTER TABLE matches 
      MODIFY COLUMN status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') 
      NOT NULL DEFAULT 'scheduled'
    `);
  }
};

