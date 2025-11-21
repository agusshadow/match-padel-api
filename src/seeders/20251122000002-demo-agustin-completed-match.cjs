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
      isPostgres
        ? `SELECT id FROM users WHERE id != ${agustin.id} ORDER BY id LIMIT 3`
        : `SELECT id FROM users WHERE id != ${agustin.id} ORDER BY id LIMIT 3`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (users.length < 3) {
      console.log('⚠️ No hay suficientes usuarios para crear el partido');
      return;
    }

    const [reservation] = await queryInterface.sequelize.query(
      isPostgres
        ? `SELECT cr.id, cr."scheduledDateTime", cr."endDateTime"
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           AND cr.id NOT IN (SELECT "reservationId" FROM matches WHERE "reservationId" IS NOT NULL)
           ORDER BY cr.id LIMIT 1`
        : `SELECT cr.id, cr.scheduledDateTime, cr.endDateTime
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           AND cr.id NOT IN (SELECT reservationId FROM matches WHERE reservationId IS NOT NULL)
           ORDER BY cr.id LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!reservation) {
      console.log('⚠️ No hay reservas disponibles');
      return;
    }

    const res = isPostgres ? {
      id: reservation.id,
      scheduledDateTime: reservation.scheduledDateTime || reservation.scheduleddatetime,
      endDateTime: reservation.endDateTime || reservation.enddatetime
    } : reservation;

    const match = {
      reservationId: res.id,
      team1Player1Id: agustin.id,
      team1Player2Id: users[0].id,
      team2Player1Id: users[1].id,
      team2Player2Id: users[2].id,
      createdBy: agustin.id,
      matchDateTime: res.scheduledDateTime ? new Date(res.scheduledDateTime) : new Date(),
      matchEndDateTime: res.endDateTime ? new Date(res.endDateTime) : new Date(),
      status: 'pending_confirmation',
      finishedAt: new Date(),
      notes: 'Partido pendiente de cargar resultado - Owner: Agustin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await queryInterface.bulkInsert('matches', [match]);
    console.log(`✅ Match pendiente de resultado creado para agustin (ID: ${agustin.id})`);
  },

  async down (queryInterface, Sequelize) {
    const isPostgres = queryInterface.sequelize.getDialect() === 'postgres';
    await queryInterface.sequelize.query(
      isPostgres
        ? `DELETE FROM matches 
           WHERE "createdBy" = (SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1)
           AND status = 'pending_confirmation'
           AND notes = 'Partido pendiente de cargar resultado - Owner: Agustin'`
        : `DELETE FROM matches 
           WHERE createdBy = (SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1)
           AND status = 'pending_confirmation'
           AND notes = 'Partido pendiente de cargar resultado - Owner: Agustin'`
    );
  }
};

