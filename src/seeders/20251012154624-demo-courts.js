'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener los IDs de los clubes
    const clubs = await queryInterface.sequelize.query(
      'SELECT id, name FROM clubs ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const clubIds = {};
    clubs.forEach(club => {
      clubIds[club.name] = club.id;
    });

    await queryInterface.bulkInsert('courts', [
      // Club Pádel Central
      {
        clubId: clubIds['Club Pádel Central'],
        name: 'Cancha 1',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Club Pádel Central'],
        name: 'Cancha 2',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Pádel Norte
      {
        clubId: clubIds['Pádel Norte'],
        name: 'Cancha Central',
        type: 'covered',
        surface: 'cement',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Pádel Norte'],
        name: 'Cancha Norte',
        type: 'outdoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Club Deportivo Sur
      {
        clubId: clubIds['Club Deportivo Sur'],
        name: 'Cancha Principal',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Club Deportivo Sur'],
        name: 'Cancha Secundaria',
        type: 'outdoor',
        surface: 'cement',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Pádel Oeste - 2 canchas
      {
        clubId: clubIds['Pádel Oeste'],
        name: 'Cancha Premium',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Pádel Oeste'],
        name: 'Cancha VIP',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Mega Pádel Center - 4 canchas
      {
        clubId: clubIds['Mega Pádel Center'],
        name: 'Cancha A',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Mega Pádel Center'],
        name: 'Cancha B',
        type: 'indoor',
        surface: 'synthetic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Mega Pádel Center'],
        name: 'Cancha C',
        type: 'covered',
        surface: 'cement',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        clubId: clubIds['Mega Pádel Center'],
        name: 'Cancha D',
        type: 'outdoor',
        surface: 'synthetic',
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
