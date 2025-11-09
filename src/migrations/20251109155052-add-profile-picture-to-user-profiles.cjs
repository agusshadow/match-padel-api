'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('user_profiles', 'picture', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL de la foto de perfil'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('user_profiles', 'picture');
  }
};

