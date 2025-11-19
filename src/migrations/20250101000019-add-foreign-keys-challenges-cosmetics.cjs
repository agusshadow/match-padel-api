'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar que ambas tablas existen
    const challengesExists = await queryInterface.tableExists('challenges');
    const cosmeticsExists = await queryInterface.tableExists('cosmetics');
    
    if (!challengesExists || !cosmeticsExists) {
      console.log('Tablas challenges o cosmetics no existen, omitiendo foreign key');
      return;
    }

    // Agregar foreign key de challenges.rewardCosmeticId a cosmetics.id
    try {
      await queryInterface.addConstraint('challenges', {
        fields: ['rewardCosmeticId'],
        type: 'foreign key',
        name: 'fk_challenges_reward_cosmetic',
        references: {
          table: 'cosmetics',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('✅ Foreign key agregada: challenges.rewardCosmeticId -> cosmetics.id');
    } catch (error) {
      // Si ya existe, ignorar
      if (error.name !== 'SequelizeDatabaseError' || !error.message.includes('already exists')) {
        console.error('Error agregando foreign key:', error);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint('challenges', 'fk_challenges_reward_cosmetic');
    } catch (error) {
      console.error('Error removiendo foreign key:', error);
    }
  }
};

