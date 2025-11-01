'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener reservas confirmadas para crear matches (aumentado para más partidos)
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
       LIMIT 30`,
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
    
    // Función para obtener jugadores con diferentes niveles de completitud
    const getPlayersWithAvailability = (availableSpots) => {
      // availableSpots puede ser: 3 (solo player1), 2 (player1+player2), 1 (player1+player2+player3), 0 (completo)
      const players = [];
      const neededPlayers = 4 - availableSpots;
      
      for (let i = 0; i < neededPlayers && userIndex < users.length * 2; i++) {
        players.push(shuffledUsers[userIndex % shuffledUsers.length]);
        userIndex++;
      }
      
      return {
        player1: players[0] || shuffledUsers[0],
        player2: neededPlayers > 1 ? (players[1] || shuffledUsers[1 % shuffledUsers.length]) : null,
        player3: neededPlayers > 2 ? (players[2] || shuffledUsers[2 % shuffledUsers.length]) : null,
        player4: availableSpots === 0 ? (players[3] || shuffledUsers[3 % shuffledUsers.length]) : null
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
    
    // 1. Partidos SCHEDULED (15 partidos con diferentes niveles de completitud)
    // Algunos solo con player1, otros con 2, 3 jugadores para que haya espacios disponibles
    const scheduledConfigs = [
      { count: 5, availableSpots: 3 },   // 5 partidos con solo player1 (3 espacios libres)
      { count: 4, availableSpots: 2 },   // 4 partidos con player1+player2 (2 espacios libres)
      { count: 4, availableSpots: 1 },   // 4 partidos con player1+player2+player3 (1 espacio libre)
      { count: 2, availableSpots: 0 }    // 2 partidos completos (4 jugadores)
    ];
    
    for (const config of scheduledConfigs) {
      for (let i = 0; i < config.count; i++) {
        const reservation = getNextReservation();
        if (!reservation) break;
        
        const players = getPlayersWithAvailability(config.availableSpots);
        matches.push({
          reservationId: reservation.reservationId,
          player1Id: players.player1.id,
          player2Id: players.player2?.id || null,
          player3Id: players.player3?.id || null,
          player4Id: players.player4?.id || null,
          createdBy: players.player1.id, // El creador siempre es player1
          status: 'scheduled',
          score: null,
          notes: `Partido programado en ${reservation.clubName} - ${reservation.courtName}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // 2. Partidos IN_PROGRESS (2 partidos - completos para poder estar en progreso)
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getPlayersWithAvailability(0); // Partidos completos
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        createdBy: players.player1.id, // El creador siempre es player1
        status: 'in_progress',
        score: null,
        notes: `Partido en curso en ${reservation.clubName} - ${reservation.courtName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 3. Partidos PENDING_CONFIRMATION (2 partidos) - Deben tener score y estar completos
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getPlayersWithAvailability(0); // Partidos completos
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        createdBy: players.player1.id, // El creador siempre es player1
        status: 'pending_confirmation',
        score: generateScore(),
        notes: `Partido finalizado, esperando confirmación - ${reservation.clubName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 4. Partidos COMPLETED (2 partidos) - Deben tener score y winner, completos
    for (let i = 0; i < 2; i++) {
      const reservation = getNextReservation();
      if (!reservation) break;
      
      const players = getPlayersWithAvailability(0); // Partidos completos
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        createdBy: players.player1.id, // El creador siempre es player1
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
      
      const players = getPlayersWithAvailability(1); // Puede estar incompleto al cancelar
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: players.player1.id,
        player2Id: players.player2?.id || null,
        player3Id: players.player3?.id || null,
        player4Id: players.player4?.id || null,
        createdBy: players.player1.id, // El creador siempre es player1
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
    
    // Contar partidos scheduled con espacios disponibles
    const scheduledMatches = matches.filter(m => m.status === 'scheduled');
    const availableCounts = scheduledMatches.reduce((acc, match) => {
      let availableSpots = 0;
      if (!match.player2Id) availableSpots++;
      if (!match.player3Id) availableSpots++;
      if (!match.player4Id) availableSpots++;
      acc[availableSpots] = (acc[availableSpots] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`✅ ${matches.length} matches de ejemplo creados exitosamente`);
    console.log(`📊 Distribución por estado:`);
    console.log(`   - scheduled: ${statusCount.scheduled || 0}`);
    console.log(`   - in_progress: ${statusCount.in_progress || 0}`);
    console.log(`   - pending_confirmation: ${statusCount.pending_confirmation || 0}`);
    console.log(`   - completed: ${statusCount.completed || 0}`);
    console.log(`   - cancelled: ${statusCount.cancelled || 0}`);
    console.log(`\n🎾 Partidos disponibles para unirse (scheduled):`);
    console.log(`   - Con 3 espacios libres: ${availableCounts[3] || 0}`);
    console.log(`   - Con 2 espacios libres: ${availableCounts[2] || 0}`);
    console.log(`   - Con 1 espacio libre: ${availableCounts[1] || 0}`);
    console.log(`   - Completos (sin espacios): ${availableCounts[0] || 0}`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('matches', null, {});
  }
};
