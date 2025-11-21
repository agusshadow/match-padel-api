'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('match_scores', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      matchId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'matches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      winnerTeam: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending_confirmation', 'confirmed', 'rejected'),
        defaultValue: 'pending_confirmation',
        allowNull: false
      },
      confirmedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rejectedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      confirmationComment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rejectionComment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confirmedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('match_scores', ['matchId'], {
      unique: true,
      name: 'idx_match_scores_match_id'
    });

    await queryInterface.addIndex('match_scores', ['status'], {
      name: 'idx_match_scores_status'
    });

    await queryInterface.addIndex('match_scores', ['confirmedBy'], {
      name: 'idx_match_scores_confirmed_by'
    });

    await queryInterface.addIndex('match_scores', ['rejectedBy'], {
      name: 'idx_match_scores_rejected_by'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_scores');
  }
};

