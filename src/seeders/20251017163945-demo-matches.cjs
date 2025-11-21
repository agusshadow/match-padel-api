'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    const reservations = await queryInterface.sequelize.query(
      isPostgres
        ? `SELECT cr.id, cr."scheduledDateTime", cr."endDateTime"
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           ORDER BY cr.id LIMIT 30`
        : `SELECT cr.id, cr.scheduledDateTime, cr.endDateTime
           FROM court_reservations cr
           WHERE cr.status = 'confirmed'
           ORDER BY cr.id LIMIT 30`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (reservations.length === 0 || users.length < 2) {
      return;
    }

    const matches = [];
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    let userIndex = 0;

    const getPlayers = (needed) => {
      const players = [];
      for (let i = 0; i < needed; i++) {
        players.push(shuffledUsers[userIndex % shuffledUsers.length]);
        userIndex++;
      }
      return {
        p1: players[0]?.id || shuffledUsers[0].id,
        p2: players[1]?.id || null,
        p3: players[2]?.id || null,
        p4: players[3]?.id || null
      };
    };

    const createMatch = (reservation, status, players, extra = {}) => {
      const res = isPostgres ? {
        id: reservation.id,
        scheduledDateTime: reservation.scheduledDateTime || reservation.scheduleddatetime,
        endDateTime: reservation.endDateTime || reservation.enddatetime
      } : reservation;

      matches.push({
        reservationId: res.id,
        team1Player1Id: players.p1,
        team1Player2Id: players.p2,
        team2Player1Id: players.p3,
        team2Player2Id: players.p4,
        createdBy: players.p1,
        matchDateTime: res.scheduledDateTime ? new Date(res.scheduledDateTime) : null,
        matchEndDateTime: res.endDateTime ? new Date(res.endDateTime) : null,
        status,
        ...extra,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    };

    let idx = 0;
    const nextRes = () => reservations[idx++];

    const configs = [
      { count: 5, needed: 1, status: 'scheduled' },
      { count: 4, needed: 2, status: 'scheduled' },
      { count: 4, needed: 3, status: 'scheduled' },
      { count: 2, needed: 4, status: 'scheduled' },
      { count: 2, needed: 4, status: 'in_progress', extra: { startedAt: new Date() } },
      { count: 2, needed: 4, status: 'pending_confirmation', extra: { finishedAt: new Date() } },
      { count: 2, needed: 4, status: 'completed', extra: { finishedAt: new Date() } },
      { count: 1, needed: 3, status: 'cancelled', extra: { cancelledAt: new Date(), cancelledBy: shuffledUsers[0].id } }
    ];

    for (const config of configs) {
      for (let i = 0; i < config.count; i++) {
        const res = nextRes();
        if (!res) break;
        createMatch(res, config.status, getPlayers(config.needed), config.extra || {});
      }
    }

    await queryInterface.bulkInsert('matches', matches);
    console.log(`✅ ${matches.length} matches creados`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('matches', null, {});
  }
};
