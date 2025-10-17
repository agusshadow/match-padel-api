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
    
    // Crear matches de ejemplo
    for (let i = 0; i < Math.min(10, confirmedReservations.length); i++) {
      const reservation = confirmedReservations[i];
      
      // Seleccionar jugadores aleatorios
      const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
      const player1 = shuffledUsers[0];
      const player2 = shuffledUsers[1] || null;
      const player3 = shuffledUsers[2] || null;
      const player4 = shuffledUsers[3] || null;
      
      // Estados posibles
      const statuses = ['scheduled', 'in_progress', 'completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Generar score solo para matches completados
      let score = null;
      if (status === 'completed') {
        const sets = [];
        for (let set = 0; set < 3; set++) {
          const team1Score = Math.floor(Math.random() * 7) + 1;
          const team2Score = Math.floor(Math.random() * 7) + 1;
          sets.push({
            team1: Math.max(team1Score, team2Score),
            team2: Math.min(team1Score, team2Score)
          });
        }
        score = JSON.stringify({ sets });
      }
      
      matches.push({
        reservationId: reservation.reservationId,
        player1Id: player1.id,
        player2Id: player2?.id || null,
        player3Id: player3?.id || null,
        player4Id: player4?.id || null,
        status: status,
        score: score,
        notes: `Partido de ${reservation.clubName} - ${reservation.courtName} de ${reservation.startTime} a ${reservation.endTime}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('matches', matches);
    console.log(`✅ ${matches.length} matches de ejemplo creados exitosamente`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('matches', null, {});
  }
};
