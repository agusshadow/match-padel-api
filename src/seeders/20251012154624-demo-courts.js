'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('courts', [
      // Club Pádel Central (ID: 1)
      {
        clubId: 1,
        name: 'Cancha 1',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: 1,
        name: 'Cancha 2',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Pádel Norte (ID: 2)
      {
        clubId: 2,
        name: 'Cancha Central',
        type: 'covered',
        surface: 'cement',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: 2,
        name: 'Cancha Norte',
        type: 'outdoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Club Deportivo Sur (ID: 3)
      {
        clubId: 3,
        name: 'Cancha Principal',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: 3,
        name: 'Cancha Secundaria',
        type: 'outdoor',
        surface: 'cement',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('courts', null, {});
  }
};
