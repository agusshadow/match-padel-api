'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    const reservations = await queryInterface.sequelize.query(
      `SELECT cr.id, cr.scheduled_date_time, cr.end_date_time
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
    const matchParticipantsData = []; // To store reservation_id -> players mapping
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    let userIndex = 0;

    const getPlayers = (needed) => {
      const players = [];
      for (let i = 0; i < needed; i++) {
        players.push(shuffledUsers[userIndex % shuffledUsers.length]);
        userIndex++;
      }
      return players;
    };

    const createMatchData = (reservation, status, players, extra = {}) => {
      const res = {
        id: reservation.id,
        scheduled_date_time: reservation.scheduled_date_time || reservation.scheduledDateTime || reservation.scheduleddatetime,
        end_date_time: reservation.end_date_time || reservation.endDateTime || reservation.enddatetime
      };

      matches.push({
        reservation_id: res.id,
        created_by: players[0]?.id || shuffledUsers[0].id,
        match_date_time: res.scheduled_date_time ? new Date(res.scheduled_date_time) : null,
        match_end_date_time: res.end_date_time ? new Date(res.end_date_time) : null,
        status,
        ...extra,
        created_at: new Date(),
        updated_at: new Date()
      });

      matchParticipantsData.push({
        reservation_id: res.id,
        players
      });
    };

    let idx = 0;
    const nextRes = () => reservations[idx++];

    const configs = [
      { count: 5, needed: 1, status: 'scheduled' },
      { count: 4, needed: 2, status: 'scheduled' },
      { count: 4, needed: 3, status: 'scheduled' },
      { count: 2, needed: 4, status: 'scheduled' },
      { count: 2, needed: 4, status: 'in_progress', extra: { started_at: new Date() } },
      { count: 2, needed: 4, status: 'pending_confirmation', extra: { finished_at: new Date() } },
      { count: 2, needed: 4, status: 'completed', extra: { finished_at: new Date() } },
      { count: 1, needed: 3, status: 'cancelled', extra: { cancelled_at: new Date(), cancelled_by: shuffledUsers[0].id } }
    ];

    for (const config of configs) {
      for (let i = 0; i < config.count; i++) {
        const res = nextRes();
        if (!res) break;
        createMatchData(res, config.status, getPlayers(config.needed), config.extra || {});
      }
    }

    await queryInterface.bulkInsert('matches', matches);
    
    // Fetch inserted matches to get their IDs
    const insertedMatches = await queryInterface.sequelize.query(
      'SELECT id, reservation_id FROM matches',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const reservationToMatchId = {};
    insertedMatches.forEach(m => {
      reservationToMatchId[m.reservation_id] = m.id;
    });

    const participants = [];
    matchParticipantsData.forEach(data => {
      const matchId = reservationToMatchId[data.reservation_id];
      data.players.forEach((player, index) => {
        // team_number: 1 for players 0 and 1, 2 for players 2 and 3
        const teamNumber = index < 2 ? 1 : 2;
        // position: can be 'drive' or 'reves' or null
        const position = index % 2 === 0 ? 'drive' : 'reves';
        
        participants.push({
          match_id: matchId,
          user_id: player.id,
          team_number: teamNumber,
          position: position,
          created_at: new Date(),
          updated_at: new Date()
        });
      });
    });

    await queryInterface.bulkInsert('match_participants', participants);
    
    console.log(`✅ ${matches.length} matches y ${participants.length} participantes creados`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('match_participants', null, {});
    await queryInterface.bulkDelete('matches', null, {});
  }
};
