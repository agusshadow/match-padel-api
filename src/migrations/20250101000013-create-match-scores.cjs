'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('match_scores', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      match_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: {
          model: 'matches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      winner_team: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending_confirmation', 'confirmed', 'rejected'),
        defaultValue: 'pending_confirmation',
        allowNull: false
      },
      confirmed_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rejected_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      confirmation_comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rejection_comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejected_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('match_scores', ['match_id'], {
      unique: true,
      name: 'idx_match_scores_match_id'
    });

    await queryInterface.addIndex('match_scores', ['status'], {
      name: 'idx_match_scores_status'
    });

    await queryInterface.addIndex('match_scores', ['confirmed_by'], {
      name: 'idx_match_scores_confirmed_by'
    });

    await queryInterface.addIndex('match_scores', ['rejected_by'], {
      name: 'idx_match_scores_rejected_by'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_scores');
  }
};

