'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar slotId a court_reservations para relacionar con court_slots
    await queryInterface.addColumn('court_reservations', 'slotId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Permitir null temporalmente para datos existentes
      references: {
        model: 'court_slots',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    
    console.log('Columna slotId agregada a court_reservations');
  },

  async down (queryInterface, Sequelize) {
    // Revertir: eliminar la columna slotId
    await queryInterface.removeColumn('court_reservations', 'slotId');
    
    console.log('Columna slotId eliminada de court_reservations');
  }
};
