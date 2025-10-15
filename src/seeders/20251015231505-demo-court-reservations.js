'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener los IDs de las canchas y usuarios
    const courts = await queryInterface.sequelize.query(
      'SELECT c.id, c.name, cl.name as clubName FROM courts c JOIN clubs cl ON c.clubId = cl.id ORDER BY c.id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const users = await queryInterface.sequelize.query(
      'SELECT id, name FROM users ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const courtIds = {};
    courts.forEach(court => {
      const key = `${court.clubName} - ${court.name}`;
      courtIds[key] = court.id;
    });
    
    const userIds = {};
    users.forEach(user => {
      userIds[user.name] = user.id;
    });

    // Obtener fechas para las próximas semanas
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    await queryInterface.bulkInsert('court_reservations', [
      // Reservas de Agustin Gonzalez (usuario ID: 1)
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        userId: userIds['Agustin Gonzalez'],
        scheduledDate: tomorrow.toISOString().split('T')[0],
        startTime: '18:00:00',
        endTime: '19:30:00',
        duration: 90,
        status: 'confirmed',
        totalPrice: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        userId: userIds['Agustin Gonzalez'],
        scheduledDate: nextWeek.toISOString().split('T')[0],
        startTime: '20:00:00',
        endTime: '21:00:00',
        duration: 60,
        status: 'pending',
        totalPrice: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        userId: userIds['Agustin Gonzalez'],
        scheduledDate: twoWeeksFromNow.toISOString().split('T')[0],
        startTime: '19:00:00',
        endTime: '20:30:00',
        duration: 90,
        status: 'confirmed',
        totalPrice: 4200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Reservas de otros usuarios
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        userId: userIds['María Rodriguez'],
        scheduledDate: tomorrow.toISOString().split('T')[0],
        startTime: '16:00:00',
        endTime: '17:00:00',
        duration: 60,
        status: 'confirmed',
        totalPrice: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        userId: userIds['Carlos López'],
        scheduledDate: nextWeek.toISOString().split('T')[0],
        startTime: '17:30:00',
        endTime: '19:00:00',
        duration: 90,
        status: 'confirmed',
        totalPrice: 4200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        userId: userIds['Ana Martínez'],
        scheduledDate: twoWeeksFromNow.toISOString().split('T')[0],
        startTime: '18:30:00',
        endTime: '19:30:00',
        duration: 60,
        status: 'pending',
        totalPrice: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        userId: userIds['Diego Fernández'],
        scheduledDate: tomorrow.toISOString().split('T')[0],
        startTime: '20:30:00',
        endTime: '22:00:00',
        duration: 90,
        status: 'completed',
        totalPrice: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        userId: userIds['Laura García'],
        scheduledDate: nextWeek.toISOString().split('T')[0],
        startTime: '15:00:00',
        endTime: '16:30:00',
        duration: 90,
        status: 'confirmed',
        totalPrice: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        userId: userIds['Roberto Silva'],
        scheduledDate: twoWeeksFromNow.toISOString().split('T')[0],
        startTime: '16:00:00',
        endTime: '17:00:00',
        duration: 60,
        status: 'cancelled',
        totalPrice: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('court_reservations', null, {});
  }
};
