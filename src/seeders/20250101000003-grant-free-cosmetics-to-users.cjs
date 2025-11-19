'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener IDs de las paletas gratuitas
    const freePalettes = await queryInterface.sequelize.query(
      "SELECT id FROM cosmetics WHERE \"acquisitionMethod\" = 'free' AND \"isActive\" = true",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!freePalettes || freePalettes.length === 0) {
      console.log('No se encontraron paletas gratuitas, omitiendo seeder');
      return;
    }

    // Obtener todos los usuarios
    const users = await queryInterface.sequelize.query(
      "SELECT id FROM users",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!users || users.length === 0) {
      console.log('No se encontraron usuarios, omitiendo seeder');
      return;
    }

    const now = new Date();
    const userCosmetics = [];

    // Para cada usuario, otorgar todas las paletas gratuitas
    for (const user of users) {
      for (const palette of freePalettes) {
        // Verificar si el usuario ya tiene esta paleta
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM user_cosmetics WHERE "userId" = ${user.id} AND "cosmeticId" = ${palette.id}`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        if (!existing) {
          userCosmetics.push({
            userId: user.id,
            cosmeticId: palette.id,
            acquiredAt: now,
            acquiredMethod: 'free',
            purchaseId: null,
            challengeId: null,
            isEquipped: false,
            createdAt: now,
            updatedAt: now
          });
        }
      }
    }

    if (userCosmetics.length > 0) {
      await queryInterface.bulkInsert('user_cosmetics', userCosmetics, {});
      console.log(`✅ ${userCosmetics.length} paletas gratuitas otorgadas a ${users.length} usuarios`);
    } else {
      console.log('Todos los usuarios ya tienen las paletas gratuitas');
    }
  },

  async down (queryInterface, Sequelize) {
    // Eliminar solo las paletas gratuitas de los usuarios
    await queryInterface.sequelize.query(
      `DELETE FROM user_cosmetics 
       WHERE "acquiredMethod" = 'free' 
       AND "cosmeticId" IN (
         SELECT id FROM cosmetics WHERE "acquisitionMethod" = 'free'
       )`,
      { type: Sequelize.QueryTypes.DELETE }
    );
  }
};

