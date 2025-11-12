'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener reservas confirmadas para crear matches (aumentado para más partidos)
    const dialect = queryInterface.sequelize.getDialect();
    const query = dialect === 'postgres'
      ? `SELECT cr.id as "reservationId", cr."userId", cr."slotId",
              cs."startTime", cs."endTime", cs.price,
              c.name as "courtName", cl.name as "clubName"
       FROM court_reservations cr
       JOIN court_slots cs ON cr."slotId" = cs.id
       JOIN courts c ON cr."courtId" = c.id
       JOIN clubs cl ON c."clubId" = cl.id
       WHERE cr.status = 'confirmed'
       ORDER BY cr.id
       LIMIT 30`
      : `SELECT cr.id as reservationId, cr.userId, cr.slotId,
              cs.startTime, cs.endTime, cs.price,
              c.name as courtName, cl.name as clubName
       FROM court_reservations cr
       JOIN court_slots cs ON cr.slotId = cs.id
       JOIN courts c ON cr.courtId = c.id
       JOIN clubs cl ON c.clubId = cl.id
       WHERE cr.status = 'confirmed'
       ORDER BY cr.id
       LIMIT 30`;
    
    const confirmedReservations = await queryInterface.sequelize.query(
      query,
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
    
    // Nota: Los scores ahora se manejan en la tabla match_scores separada
    // Esta función ya no se usa, pero la mantenemos comentada para referencia
    // const generateScore = () => { ... };
    
    // Normalizar datos de reservas (PostgreSQL devuelve nombres en minúsculas)
    const normalizedReservations = confirmedReservations.map(res => ({
      reservationId: res.reservationId || res.reservationid,
      userId: res.userId || res.userid,
      slotId: res.slotId || res.slotid,
      startTime: res.startTime || res.starttime,
      endTime: res.endTime || res.endtime,
      courtName: res.courtName || res.courtname,
      clubName: res.clubName || res.clubname
    }));
    
    // Obtener reservas completas con scheduledDate para calcular fechas
    const reservationDetails = await queryInterface.sequelize.query(
      dialect === 'postgres'
        ? `SELECT cr.id, cr."scheduledDate", cr."scheduledDateTime", cr."endDateTime"
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           ORDER BY cr.id
           LIMIT 30`
        : `SELECT cr.id, cr.scheduledDate, cr.scheduledDateTime, cr.endDateTime
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           ORDER BY cr.id
           LIMIT 30`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Crear mapa de reservationId -> fechas
    const reservationDatesMap = {};
    reservationDetails.forEach(res => {
      const id = res.id;
      reservationDatesMap[id] = {
        scheduledDate: res.scheduledDate || res.scheduleddate,
        scheduledDateTime: res.scheduledDateTime || res.scheduleddatetime,
        endDateTime: res.endDateTime || res.enddatetime
      };
    });
    
    // Seleccionar jugadores de forma distribuida
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    let userIndex = 0;
    
    // Función para obtener jugadores con diferentes niveles de completitud
    const getPlayersWithAvailability = (availableSpots) => {
      // availableSpots puede ser: 3 (solo team1Player1), 2 (team1Player1+team1Player2), 1 (team1Player1+team1Player2+team2Player1), 0 (completo)
      const players = [];
      const neededPlayers = 4 - availableSpots;
      
      for (let i = 0; i < neededPlayers && userIndex < users.length * 2; i++) {
        players.push(shuffledUsers[userIndex % shuffledUsers.length]);
        userIndex++;
      }
      
      return {
        team1Player1: players[0] || shuffledUsers[0], // Siempre el creador
        team1Player2: neededPlayers > 1 ? (players[1] || shuffledUsers[1 % shuffledUsers.length]) : null,
        team2Player1: neededPlayers > 2 ? (players[2] || shuffledUsers[2 % shuffledUsers.length]) : null,
        team2Player2: availableSpots === 0 ? (players[3] || shuffledUsers[3 % shuffledUsers.length]) : null
      };
    };
    
    // Crear partidos con TODOS los estados para pruebas
    let reservationIndex = 0;
    
    // Función auxiliar para obtener la siguiente reserva disponible
    const getNextReservation = () => {
      if (reservationIndex >= normalizedReservations.length) {
        return null;
      }
      return normalizedReservations[reservationIndex++];
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
        const reservationDates = reservationDatesMap[reservation.reservationId] || {};
        
        // Calcular matchDateTime y matchEndDateTime
        let matchDateTime = null;
        let matchEndDateTime = null;
        
        if (reservationDates.scheduledDateTime) {
          matchDateTime = new Date(reservationDates.scheduledDateTime);
        } else if (reservationDates.scheduledDate && reservation.startTime) {
          // Fallback: calcular desde scheduledDate + startTime
          const [hours, minutes] = reservation.startTime.split(':').map(Number);
          matchDateTime = new Date(reservationDates.scheduledDate);
          matchDateTime.setHours(hours, minutes, 0, 0);
        }
        
        if (reservationDates.endDateTime) {
          matchEndDateTime = new Date(reservationDates.endDateTime);
        } else if (matchDateTime && reservation.endTime) {
          // Fallback: calcular desde matchDateTime + 90 minutos
          const [hours, minutes] = reservation.endTime.split(':').map(Number);
          matchEndDateTime = new Date(reservationDates.scheduledDate || matchDateTime);
          matchEndDateTime.setHours(hours, minutes, 0, 0);
        }
        
        matches.push({
          reservationId: reservation.reservationId,
          team1Player1Id: players.team1Player1.id,
          team1Player2Id: players.team1Player2?.id || null,
          team2Player1Id: players.team2Player1?.id || null,
          team2Player2Id: players.team2Player2?.id || null,
          createdBy: players.team1Player1.id, // El creador siempre es team1Player1
          matchDateTime: matchDateTime,      // ⭐ Campo denormalizado
          matchEndDateTime: matchEndDateTime, // ⭐ Campo denormalizado
          status: 'scheduled',
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
      const reservationDates = reservationDatesMap[reservation.reservationId] || {};
      
      let matchDateTime = null;
      let matchEndDateTime = null;
      
      if (reservationDates.scheduledDateTime) {
        matchDateTime = new Date(reservationDates.scheduledDateTime);
      }
      if (reservationDates.endDateTime) {
        matchEndDateTime = new Date(reservationDates.endDateTime);
      }
      
      matches.push({
        reservationId: reservation.reservationId,
        team1Player1Id: players.team1Player1.id,
        team1Player2Id: players.team1Player2?.id || null,
        team2Player1Id: players.team2Player1?.id || null,
        team2Player2Id: players.team2Player2?.id || null,
        createdBy: players.team1Player1.id,
        matchDateTime: matchDateTime,
        matchEndDateTime: matchEndDateTime,
        status: 'in_progress',
        startedAt: new Date(), // ⭐ Campo de auditoría
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
      const reservationDates = reservationDatesMap[reservation.reservationId] || {};
      
      let matchDateTime = null;
      let matchEndDateTime = null;
      
      if (reservationDates.scheduledDateTime) {
        matchDateTime = new Date(reservationDates.scheduledDateTime);
      }
      if (reservationDates.endDateTime) {
        matchEndDateTime = new Date(reservationDates.endDateTime);
      }
      
      matches.push({
        reservationId: reservation.reservationId,
        team1Player1Id: players.team1Player1.id,
        team1Player2Id: players.team1Player2?.id || null,
        team2Player1Id: players.team2Player1?.id || null,
        team2Player2Id: players.team2Player2?.id || null,
        createdBy: players.team1Player1.id,
        matchDateTime: matchDateTime,
        matchEndDateTime: matchEndDateTime,
        status: 'pending_confirmation',
        finishedAt: new Date(), // ⭐ Campo de auditoría
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
      const reservationDates = reservationDatesMap[reservation.reservationId] || {};
      
      let matchDateTime = null;
      let matchEndDateTime = null;
      
      if (reservationDates.scheduledDateTime) {
        matchDateTime = new Date(reservationDates.scheduledDateTime);
      }
      if (reservationDates.endDateTime) {
        matchEndDateTime = new Date(reservationDates.endDateTime);
      }
      
      matches.push({
        reservationId: reservation.reservationId,
        team1Player1Id: players.team1Player1.id,
        team1Player2Id: players.team1Player2?.id || null,
        team2Player1Id: players.team2Player1?.id || null,
        team2Player2Id: players.team2Player2?.id || null,
        createdBy: players.team1Player1.id,
        matchDateTime: matchDateTime,
        matchEndDateTime: matchEndDateTime,
        status: 'completed',
        finishedAt: new Date(),
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
      const reservationDates = reservationDatesMap[reservation.reservationId] || {};
      
      let matchDateTime = null;
      let matchEndDateTime = null;
      
      if (reservationDates.scheduledDateTime) {
        matchDateTime = new Date(reservationDates.scheduledDateTime);
      }
      if (reservationDates.endDateTime) {
        matchEndDateTime = new Date(reservationDates.endDateTime);
      }
      
      matches.push({
        reservationId: reservation.reservationId,
        team1Player1Id: players.team1Player1.id,
        team1Player2Id: players.team1Player2?.id || null,
        team2Player1Id: players.team2Player1?.id || null,
        team2Player2Id: players.team2Player2?.id || null,
        createdBy: players.team1Player1.id,
        matchDateTime: matchDateTime,
        matchEndDateTime: matchEndDateTime,
        status: 'cancelled',
        cancelledAt: new Date(), // ⭐ Campo de auditoría
        cancelledBy: players.team1Player1.id, // ⭐ Campo de auditoría
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
      if (!match.team1Player2Id) availableSpots++;
      if (!match.team2Player1Id) availableSpots++;
      if (!match.team2Player2Id) availableSpots++;
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
