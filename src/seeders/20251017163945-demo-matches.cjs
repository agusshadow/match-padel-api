'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener reservas confirmadas para crear matches
    const confirmedReservations = await queryInterface.sequelize.query(
      `SELECT cr.id as reservationId, cr.userId, cr.slotId,
              cs.startTime, cs.endTime, cs.price,
              c.name as courtName, cl.name as clubName
       FROM court_reservations cr
       JOIN court_slots cs ON cr.slotId = cs.id
       JOIN courts c ON cr.courtId = c.id
       JOIN clubs cl ON c.clubId = cl.id
       WHERE cr.status = 'confirmed'
       ORDER BY cr.id
       LIMIT 15`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Obtener usuarios para los jugadores
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (confirmedReservations.length === 0 || users.length < 2) {
      console.log('⚠️ No hay reservas confirmadas o usuarios suficientes para crear matches');
      return;
    }

    const matches = [];
    
    // Función auxiliar para generar score realista
    const generateScore = () => {
      const sets = [];
      const numSets = 3; // Mejor de 3 sets
      
      // Decidir qué equipo ganará el partido (2 de 3 sets)
      const winnerTeam = Math.random() > 0.5 ? 'team1' : 'team2';
      const winnerWins = 2;
      const loserWins = numSets - winnerWins;
      
      let team1Wins = 0;
      let team2Wins = 0;
      
      // Generar sets
      for (let set = 0; set < numSets; set++) {
        let team1Score, team2Score;
        
        // Determinar quién gana este set
        let shouldTeam1Win;
        if (winnerTeam === 'team1') {
          // Si team1 es el ganador, debe ganar 2 sets
          shouldTeam1Win = team1Wins < winnerWins;
        } else {
          // Si team2 es el ganador, team2 debe ganar 2 sets
          shouldTeam1Win = team2Wins >= winnerWins;
        }
        
        if (shouldTeam1Win) {
          // Team1 gana este set
          team1Score = Math.floor(Math.random() * 3) + 6; // 6-8
          team2Score = Math.floor(Math.random() * 5) + 0; // 0-4
          team1Wins++;
        } else {
          // Team2 gana este set
          team1Score = Math.floor(Math.random() * 5) + 0; // 0-4
          team2Score = Math.floor(Math.random() * 3) + 6; // 6-8
          team2Wins++;
        }
        
        sets.push({
          team1: team1Score,
          team2: team2Score
        });
      }
      
      return JSON.stringify({ sets, winner: winnerTeam });
    };
    
    // Seleccionar jugadores de forma distribuida
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    let userIndex = 0;
    
    const getNextPlayers = (count = 4) => {
      const players = [];
      for (let i = 0; i < count && userIndex < users.length; i++) {
        players.push(shuffledUsers[userIndex]);
        userIndex = (userIndex + 1) % users.length;
      }
      return {
        player1: players[0] || shuffledUsers[0],
        player2: players[1] || shuffledUsers[1] || null,
        player3: players[2] || shuffledUsers[2] || null,
        player4: players[3] || shuffledUsers[3] || null
      };
    };
    
    // Crear partidos con TODOS los estados para pruebas
    let reservationIndex = 0;
    
    // Función auxiliar para obtener la siguiente reserva disponible
    const getNextReservation = () => {
      if (reservationIndex >= confirmedReservations.length) {
        return null;
      }
      return confirmedReservations[reservationIndex++];
    };
    
    // 1. Partidos SCHEDULED (3 partidos)
    for (let i = 0; i < 3; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getNextPlayers();
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        status: 'scheduled',
        score: null,
        notes: `Partido programado en ${reservation.clubName} - ${reservation.courtName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 2. Partidos IN_PROGRESS (2 partidos)
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getNextPlayers();
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        status: 'in_progress',
        score: null,
        notes: `Partido en curso en ${reservation.clubName} - ${reservation.courtName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 3. Partidos PENDING_CONFIRMATION (2 partidos) - Deben tener score
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getNextPlayers();
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        status: 'pending_confirmation',
        score: generateScore(),
        notes: `Partido finalizado, esperando confirmación - ${reservation.clubName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 4. Partidos COMPLETED (2 partidos) - Deben tener score y winner
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getNextPlayers();
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        status: 'completed',
        score: generateScore(),
        notes: `Partido completado en ${reservation.clubName} - ${reservation.courtName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 5. Partidos CANCELLED (1 partido)
    for (let i = 0; i < 1; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getNextPlayers();
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        status: 'cancelled',
        score: null,
        notes: `Partido cancelado - ${reservation.clubName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('matches', matches);
    
    // Contar por estado para el log
    const statusCount = matches.reduce((acc, match) => {
      acc[match.status] = (acc[match.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`✅ ${matches.length} matches de ejemplo creados exitosamente`);
    console.log(`📊 Distribución por estado:`);
    console.log(`   - scheduled: ${statusCount.scheduled || 0}`);
    console.log(`   - in_progress: ${statusCount.in_progress || 0}`);
    console.log(`   - pending_confirmation: ${statusCount.pending_confirmation || 0}`);
    console.log(`   - completed: ${statusCount.completed || 0}`);
    console.log(`   - cancelled: ${statusCount.cancelled || 0}`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('matches', null, {});
  }
};
