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

    // Obtener el ID de la paleta "Paleta Campeona" (challenge reward)
    const [cosmetics] = await queryInterface.sequelize.query(
      "SELECT id FROM cosmetics WHERE name = 'Paleta Campeona' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const championPaletteId = cosmetics ? cosmetics.id : null;

    await queryInterface.bulkInsert('challenges', [
      // DESAFÍOS DIARIOS
      {
        title: 'Ganar un partido',
        description: 'Completa una victoria',
        type: 'daily',
        actionType: 'WIN_MATCH',
        targetValue: 1,
        rewardType: 'both',
        rewardXp: 50,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Jugar 2 partidos',
        description: 'Participa en 2 partidos',
        type: 'daily',
        actionType: 'PLAY_MATCH',
        targetValue: 2,
        rewardType: 'both',
        rewardXp: 75,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Racha de 3 victorias',
        description: 'Gana 3 partidos consecutivos',
        type: 'daily',
        actionType: 'WIN_MATCH',
        targetValue: 3,
        rewardType: 'both',
        rewardXp: 100,
        rewardCosmeticId: null,
        isActive: true,
        metadata: JSON.stringify({
          consecutive: true,
          note: 'Debe ser en el mismo día'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // DESAFÍOS SEMANALES
      {
        title: 'Ganar 5 partidos',
        description: 'Gana 5 partidos esta semana',
        type: 'weekly',
        actionType: 'WIN_MATCH',
        targetValue: 5,
        rewardType: 'both',
        rewardXp: 200,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Jugar 10 partidos',
        description: 'Participa en 10 partidos esta semana',
        type: 'weekly',
        actionType: 'PLAY_MATCH',
        targetValue: 10,
        rewardType: 'both',
        rewardXp: 300,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Racha de 3 victorias',
        description: 'Gana 3 partidos consecutivos esta semana',
        type: 'weekly',
        actionType: 'WIN_MATCH',
        targetValue: 3,
        rewardType: 'both',
        rewardXp: 150,
        rewardCosmeticId: championPaletteId, // Paleta Campeona como recompensa
        isActive: true,
        metadata: JSON.stringify({
          consecutive: true,
          note: 'Debe ser consecutivo'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Ganador invicto',
        description: 'Gana 7 partidos sin perder esta semana',
        type: 'weekly',
        actionType: 'WIN_MATCH',
        targetValue: 7,
        rewardType: 'both',
        rewardXp: 500,
        rewardCosmeticId: null,
        isActive: true,
        metadata: JSON.stringify({
          noLosses: true,
          note: 'Debe ganar 7 sin perder ninguno'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // DESAFÍOS MENSUALES
      {
        title: 'Ganar 20 partidos',
        description: 'Gana 20 partidos este mes',
        type: 'monthly',
        actionType: 'WIN_MATCH',
        targetValue: 20,
        rewardType: 'both',
        rewardXp: 1000,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Jugar 50 partidos',
        description: 'Participa en 50 partidos este mes',
        type: 'monthly',
        actionType: 'PLAY_MATCH',
        targetValue: 50,
        rewardType: 'both',
        rewardXp: 1500,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Maestro del pádel',
        description: 'Gana 30 partidos este mes',
        type: 'monthly',
        actionType: 'WIN_MATCH',
        targetValue: 30,
        rewardType: 'both',
        rewardXp: 2000,
        rewardCosmeticId: null,
        isActive: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // Actualizar el challengeId de la paleta "Paleta Campeona" si existe
    if (championPaletteId) {
      const [challenge] = await queryInterface.sequelize.query(
        "SELECT id FROM challenges WHERE title = 'Racha de 3 victorias' AND type = 'weekly' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (challenge) {
        await queryInterface.sequelize.query(
          `UPDATE cosmetics SET "challengeId" = ${challenge.id} WHERE id = ${championPaletteId}`,
          { type: Sequelize.QueryTypes.UPDATE }
        );
      }
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('challenges', null, {});
  }
};

