'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('challenges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      title: {
        type: Sequelize.TEXT(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT(500),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly'),
        allowNull: false
      },
      action_type: {
        type: Sequelize.TEXT(100),
        allowNull: false
      },
      target_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      reward_type: {
        type: Sequelize.ENUM('xp', 'cosmetic', 'both'),
        allowNull: false
      },
      reward_xp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reward_cosmetic_id: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('challenges', ['type'], {
      name: 'idx_challenges_type'
    });

    await queryInterface.addIndex('challenges', ['is_active'], {
      name: 'idx_challenges_is_active'
    });

    await queryInterface.addIndex('challenges', ['action_type'], {
      name: 'idx_challenges_action_type'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('challenges');
  }
};

