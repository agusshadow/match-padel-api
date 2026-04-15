'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_challenges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      challenge_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'challenges',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      progress: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'claimed', 'expired'),
        allowNull: false,
        defaultValue: 'pending'
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      claimed_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('user_challenges', ['user_id', 'status'], {
      name: 'idx_user_challenges_user_status'
    });

    await queryInterface.addIndex('user_challenges', ['user_id', 'expires_at'], {
      name: 'idx_user_challenges_user_expires'
    });

    await queryInterface.addIndex('user_challenges', ['challenge_id'], {
      name: 'idx_user_challenges_challenge'
    });

    await queryInterface.addIndex('user_challenges', ['user_id', 'challenge_id', 'status'], {
      name: 'idx_user_challenges_user_challenge_status'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_challenges');
  }
};

