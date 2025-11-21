'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_challenges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      challengeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'challenges',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      expiresAt: {
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
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      claimedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('user_challenges', ['userId', 'status'], {
      name: 'idx_user_challenges_user_status'
    });

    await queryInterface.addIndex('user_challenges', ['userId', 'expiresAt'], {
      name: 'idx_user_challenges_user_expires'
    });

    await queryInterface.addIndex('user_challenges', ['challengeId'], {
      name: 'idx_user_challenges_challenge'
    });

    await queryInterface.addIndex('user_challenges', ['userId', 'challengeId', 'status'], {
      name: 'idx_user_challenges_user_challenge_status'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_challenges');
  }
};

