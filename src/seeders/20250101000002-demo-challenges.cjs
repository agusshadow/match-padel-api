'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar si ya existen desafíos
    const challengesCount = await queryInterface.sequelize.query(
      "SELECT COUNT(*) FROM challenges",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (parseInt(challengesCount[0].count) > 0) {
      console.log('Ya existen desafíos, omitiendo seeder');
      return;
    }


    await queryInterface.bulkInsert('challenges', [
      // DESAFÍOS DIARIOS
      {
        title: 'Ganar un partido',
        description: 'Completa una victoria',
        type: 'daily',
        action_type: 'WIN_MATCH',
        target_value: 1,
        reward_type: 'both',
        reward_xp: 50,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Jugar 2 partidos',
        description: 'Participa en 2 partidos',
        type: 'daily',
        action_type: 'PLAY_MATCH',
        target_value: 2,
        reward_type: 'both',
        reward_xp: 75,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Racha de 3 victorias',
        description: 'Gana 3 partidos consecutivos',
        type: 'daily',
        action_type: 'WIN_MATCH',
        target_value: 3,
        reward_type: 'both',
        reward_xp: 100,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: JSON.stringify({
          consecutive: true,
          note: 'Debe ser en el mismo día'
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      // DESAFÍOS SEMANALES
      {
        title: 'Ganar 5 partidos',
        description: 'Gana 5 partidos esta semana',
        type: 'weekly',
        action_type: 'WIN_MATCH',
        target_value: 5,
        reward_type: 'both',
        reward_xp: 200,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Jugar 10 partidos',
        description: 'Participa en 10 partidos esta semana',
        type: 'weekly',
        action_type: 'PLAY_MATCH',
        target_value: 10,
        reward_type: 'both',
        reward_xp: 300,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Racha de 3 victorias',
        description: 'Gana 3 partidos consecutivos esta semana',
        type: 'weekly',
        action_type: 'WIN_MATCH',
        target_value: 3,
        reward_type: 'both',
        reward_xp: 150,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: JSON.stringify({
          consecutive: true,
          note: 'Debe ser consecutivo'
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Ganador invicto',
        description: 'Gana 7 partidos sin perder esta semana',
        type: 'weekly',
        action_type: 'WIN_MATCH',
        target_value: 7,
        reward_type: 'both',
        reward_xp: 500,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: JSON.stringify({
          noLosses: true,
          note: 'Debe ganar 7 sin perder ninguno'
        }),
        created_at: new Date(),
        updated_at: new Date()
      },
      // DESAFÍOS MENSUALES
      {
        title: 'Ganar 20 partidos',
        description: 'Gana 20 partidos este mes',
        type: 'monthly',
        action_type: 'WIN_MATCH',
        target_value: 20,
        reward_type: 'both',
        reward_xp: 1000,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Jugar 50 partidos',
        description: 'Participa en 50 partidos este mes',
        type: 'monthly',
        action_type: 'PLAY_MATCH',
        target_value: 50,
        reward_type: 'both',
        reward_xp: 1500,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Maestro del pádel',
        description: 'Gana 30 partidos este mes',
        type: 'monthly',
        action_type: 'WIN_MATCH',
        target_value: 30,
        reward_type: 'both',
        reward_xp: 2000,
        reward_cosmetic_id: null,
        is_active: true,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('challenges', null, {});
  }
};

