'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn('matches', 'duration');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('matches', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 300 // Máximo 5 horas
      }
    });
  }
};
