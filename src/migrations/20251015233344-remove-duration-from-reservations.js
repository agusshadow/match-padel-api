'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Eliminar campo duration de la tabla court_reservations
    await queryInterface.removeColumn('court_reservations', 'duration');
  },

  async down (queryInterface, Sequelize) {
    // Restaurar campo duration
    await queryInterface.addColumn('court_reservations', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[60, 90]]
      }
    });
  }
};
