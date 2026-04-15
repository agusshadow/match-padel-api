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
        club_id: clubIds['Club Pádel Central'],
        name: 'Cancha 1',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Club Pádel Central'],
        name: 'Cancha 2',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Pádel Norte
      {
        club_id: clubIds['Pádel Norte'],
        name: 'Cancha Central',
        type: 'covered',
        surface: 'cement',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Pádel Norte'],
        name: 'Cancha Norte',
        type: 'outdoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Club Deportivo Sur
      {
        club_id: clubIds['Club Deportivo Sur'],
        name: 'Cancha Principal',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Club Deportivo Sur'],
        name: 'Cancha Secundaria',
        type: 'outdoor',
        surface: 'cement',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Pádel Oeste - 2 canchas
      {
        club_id: clubIds['Pádel Oeste'],
        name: 'Cancha Premium',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Pádel Oeste'],
        name: 'Cancha VIP',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Mega Pádel Center - 4 canchas
      {
        club_id: clubIds['Mega Pádel Center'],
        name: 'Cancha A',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Mega Pádel Center'],
        name: 'Cancha B',
        type: 'indoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Mega Pádel Center'],
        name: 'Cancha C',
        type: 'covered',
        surface: 'cement',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        club_id: clubIds['Mega Pádel Center'],
        name: 'Cancha D',
        type: 'outdoor',
        surface: 'synthetic',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('courts', null, {});
  }
};
