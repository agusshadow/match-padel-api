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

    await queryInterface.bulkInsert('matches', [
      // Partidos de Agustin Gonzalez (usuario ID: 1)
      {
        reservationId: reservations[0].id, // Primera reserva de Agustin
        player1Id: userIds['Agustin Gonzalez'],
        player2Id: userIds['María Rodriguez'],
        player3Id: userIds['Carlos López'],
        player4Id: userIds['Ana Martínez'],
        status: 'scheduled',
        notes: 'Partido amistoso entre equipos mixtos',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        reservationId: reservations[1].id, // Segunda reserva de Agustin
        player1Id: userIds['Agustin Gonzalez'],
        player2Id: userIds['Diego Fernández'],
        player3Id: userIds['María Rodriguez'],
        player4Id: userIds['Carlos López'],
        status: 'scheduled',
        notes: 'Partido de práctica individual',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        reservationId: reservations[2].id, // Tercera reserva de Agustin
        player1Id: userIds['Agustin Gonzalez'],
        player2Id: userIds['Laura García'],
        player3Id: userIds['Roberto Silva'],
        player4Id: userIds['María Rodriguez'],
        status: 'scheduled',
        notes: 'Torneo interno del club',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Otros partidos
      {
        reservationId: reservations[3].id, // Reserva de María Rodriguez
        player1Id: userIds['María Rodriguez'],
        player2Id: userIds['Carlos López'],
        player3Id: userIds['Ana Martínez'],
        player4Id: userIds['Diego Fernández'],
        status: 'completed',
        score: JSON.stringify({
          sets: [
            { team1: 6, team2: 4 },
            { team1: 6, team2: 2 }
          ],
          winner: 'team1'
        }),
        duration: 65,
        notes: 'Partido de entrenamiento completado',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        reservationId: reservations[4].id, // Reserva de Carlos López
        player1Id: userIds['Carlos López'],
        player2Id: userIds['Ana Martínez'],
        player3Id: userIds['Diego Fernández'],
        player4Id: userIds['Laura García'],
        status: 'in_progress',
        notes: 'Partido en curso - muy competitivo',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        reservationId: reservations[5].id, // Reserva de Diego Fernández (completada)
        player1Id: userIds['Diego Fernández'],
        player2Id: userIds['Roberto Silva'],
        player3Id: userIds['María Rodriguez'],
        player4Id: userIds['Ana Martínez'],
        status: 'completed',
        score: JSON.stringify({
          sets: [
            { team1: 6, team2: 3 },
            { team1: 4, team2: 6 },
            { team1: 6, team2: 4 }
          ],
          winner: 'team1'
        }),
        duration: 95,
        notes: 'Gran partido, muy parejo hasta el final',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        reservationId: reservations[6].id, // Reserva de Laura García
        player1Id: userIds['Laura García'],
        player2Id: userIds['María Rodriguez'],
        player3Id: userIds['Ana Martínez'],
        player4Id: userIds['Agustin Gonzalez'],
        status: 'scheduled',
        notes: 'Partido de fin de semana',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('matches', null, {});
  }
};
