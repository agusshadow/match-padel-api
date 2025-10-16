'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener los IDs de las reservas y usuarios
    const reservations = await queryInterface.sequelize.query(
      'SELECT id FROM court_reservations ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const users = await queryInterface.sequelize.query(
      'SELECT id, name FROM users ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const userIds = {};
    users.forEach(user => {
      userIds[user.name] = user.id;
    });

    // Crear reservas adicionales para partidos incompletos
    const courts = await queryInterface.sequelize.query(
      'SELECT c.id, c.name, cl.name as clubName FROM courts c JOIN clubs cl ON c.clubId = cl.id ORDER BY c.id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const courtIds = {};
    courts.forEach(court => {
      const key = `${court.clubName} - ${court.name}`;
      courtIds[key] = court.id;
    });

    // Fechas para las nuevas reservas
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    // Crear reservas adicionales para partidos incompletos
    const newReservations = await queryInterface.bulkInsert('court_reservations', [
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        userId: userIds['Agustin Gonzalez'],
        scheduledDate: nextWeek.toISOString().split('T')[0],
        startTime: '19:00:00',
        endTime: '20:30:00',
        status: 'confirmed',
        totalPrice: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        userId: userIds['María Rodriguez'],
        scheduledDate: twoWeeksFromNow.toISOString().split('T')[0],
        startTime: '18:00:00',
        endTime: '19:30:00',
        status: 'confirmed',
        totalPrice: 4200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        userId: userIds['Carlos López'],
        scheduledDate: nextWeek.toISOString().split('T')[0],
        startTime: '20:00:00',
        endTime: '21:30:00',
        status: 'confirmed',
        totalPrice: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        userId: userIds['Ana Martínez'],
        scheduledDate: twoWeeksFromNow.toISOString().split('T')[0],
        startTime: '17:00:00',
        endTime: '18:30:00',
        status: 'confirmed',
        totalPrice: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { returning: true });

    // Obtener los IDs de las nuevas reservas
    const newReservationIds = await queryInterface.sequelize.query(
      'SELECT id FROM court_reservations ORDER BY id DESC LIMIT 4',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    await queryInterface.bulkInsert('matches', [
      // Partido con solo 2 jugadores (singles)
      {
        reservationId: newReservationIds[0].id,
        player1Id: userIds['Agustin Gonzalez'],
        player2Id: userIds['María Rodriguez'],
        player3Id: null,
        player4Id: null,
        status: 'scheduled',
        notes: 'Partido de singles - buscando más jugadores para completar el equipo',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Partido con 3 jugadores (falta 1)
      {
        reservationId: newReservationIds[1].id,
        player1Id: userIds['María Rodriguez'],
        player2Id: userIds['Carlos López'],
        player3Id: userIds['Ana Martínez'],
        player4Id: null,
        status: 'scheduled',
        notes: 'Partido de doubles - falta 1 jugador para completar el equipo',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Partido con solo 2 jugadores (singles) - en progreso
      {
        reservationId: newReservationIds[2].id,
        player1Id: userIds['Carlos López'],
        player2Id: userIds['Diego Fernández'],
        player3Id: null,
        player4Id: null,
        status: 'in_progress',
        notes: 'Partido de singles en curso - muy competitivo',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Partido con 3 jugadores (falta 1) - completado
      {
        reservationId: newReservationIds[3].id,
        player1Id: userIds['Ana Martínez'],
        player2Id: userIds['Laura García'],
        player3Id: userIds['Roberto Silva'],
        player4Id: null,
        status: 'completed',
        score: JSON.stringify({
          sets: [
            { team1: 6, team2: 4 },
            { team1: 6, team2: 3 }
          ],
          winner: 'team1'
        }),
        duration: 75,
        notes: 'Partido completado con 3 jugadores - el equipo de 2 jugadores ganó',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    // Eliminar los matches creados
    await queryInterface.bulkDelete('matches', {
      notes: {
        [queryInterface.Sequelize.Op.like]: '%falta%'
      }
    }, {});
    
    // Eliminar las reservas creadas (las últimas 4)
    await queryInterface.sequelize.query(
      'DELETE FROM court_reservations WHERE id IN (SELECT id FROM court_reservations ORDER BY id DESC LIMIT 4)'
    );
  }
};
