'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const isPostgres = queryInterface.sequelize.getDialect() === 'postgres';
    
    const [agustin] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!agustin) {
      console.log('⚠️ Usuario agustin@example.com no encontrado');
      return;
    }

    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE id != ${agustin.id} ORDER BY id LIMIT 3`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (users.length < 3) {
      console.log('⚠️ No hay suficientes usuarios para crear el partido');
      return;
    }

    const [reservation] = await queryInterface.sequelize.query(
      `SELECT cr.id, cr.scheduled_date_time, cr.end_date_time
       FROM court_reservations cr
       WHERE cr.status = 'confirmed'
       AND cr.id NOT IN (SELECT reservation_id FROM matches WHERE reservation_id IS NOT NULL)
       ORDER BY cr.id LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!reservation) {
      console.log('⚠️ No hay reservas disponibles');
      return;
    }

    const res = {
      id: reservation.id,
      scheduled_date_time: reservation.scheduled_date_time || reservation.scheduledDateTime || reservation.scheduleddatetime,
      end_date_time: reservation.end_date_time || reservation.endDateTime || reservation.enddatetime
    };

    const match = {
      reservation_id: res.id,
      created_by: agustin.id,
      match_date_time: res.scheduled_date_time ? new Date(res.scheduled_date_time) : new Date(),
      match_end_date_time: res.end_date_time ? new Date(res.end_date_time) : new Date(),
      status: 'pending_confirmation',
      finished_at: new Date(),
      notes: 'Partido pendiente de cargar resultado - Owner: Agustin',
      created_at: new Date(),
      updated_at: new Date()
    };

    await queryInterface.bulkInsert('matches', [match]);
    
    // Get the inserted match ID
    const [insertedMatch] = await queryInterface.sequelize.query(
      `SELECT id FROM matches WHERE reservation_id = ${res.id} LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (insertedMatch) {
      const participants = [
        { match_id: insertedMatch.id, user_id: agustin.id, team_number: 1, position: 'drive', created_at: new Date(), updated_at: new Date() },
        { match_id: insertedMatch.id, user_id: users[0].id, team_number: 1, position: 'reves', created_at: new Date(), updated_at: new Date() },
        { match_id: insertedMatch.id, user_id: users[1].id, team_number: 2, position: 'drive', created_at: new Date(), updated_at: new Date() },
        { match_id: insertedMatch.id, user_id: users[2].id, team_number: 2, position: 'reves', created_at: new Date(), updated_at: new Date() }
      ];
      await queryInterface.bulkInsert('match_participants', participants);
    }

    console.log(`✅ Match pendiente de resultado creado para agustin (ID: ${agustin.id})`);
  },

  async down (queryInterface, Sequelize) {
    const [agustin] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (agustin) {
      const [match] = await queryInterface.sequelize.query(
        `SELECT id FROM matches WHERE created_by = ${agustin.id} AND status = 'pending_confirmation' AND notes = 'Partido pendiente de cargar resultado - Owner: Agustin' LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (match) {
        await queryInterface.bulkDelete('match_participants', { match_id: match.id });
        await queryInterface.bulkDelete('matches', { id: match.id });
      }
    }
  }
};
