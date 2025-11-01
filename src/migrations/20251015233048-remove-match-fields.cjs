'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Eliminar campos matchType y skillLevel de la tabla matches
    await queryInterface.removeColumn('matches', 'matchType');
    await queryInterface.removeColumn('matches', 'skillLevel');
  },

  async down (queryInterface, Sequelize) {
    // Restaurar campos matchType y skillLevel
    await queryInterface.addColumn('matches', 'matchType', {
      type: Sequelize.ENUM('singles', 'doubles'),
      allowNull: false,
      defaultValue: 'doubles'
    });
    
    await queryInterface.addColumn('matches', 'skillLevel', {
      type: Sequelize.ENUM('beginner', 'intermediate', 'advanced', 'professional'),
      allowNull: false,
      defaultValue: 'intermediate'
    });
  }
};
