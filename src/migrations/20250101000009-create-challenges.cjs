'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('challenges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly'),
        allowNull: false
      },
      actionType: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      targetValue: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      rewardType: {
        type: Sequelize.ENUM('xp', 'cosmetic', 'both'),
        allowNull: false
      },
      rewardXp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      rewardCosmeticId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('challenges', ['type'], {
      name: 'idx_challenges_type'
    });

    await queryInterface.addIndex('challenges', ['isActive'], {
      name: 'idx_challenges_is_active'
    });

    await queryInterface.addIndex('challenges', ['actionType'], {
      name: 'idx_challenges_action_type'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('challenges');
  }
};

