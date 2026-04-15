'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('matches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      reservation_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'court_reservations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_by: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'pending_confirmation', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
        allowNull: false
      },
      match_date_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      match_end_date_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('matches', ['reservation_id'], {
      unique: true,
      name: 'idx_matches_reservation_unique'
    });

    await queryInterface.addIndex('matches', ['created_by'], {
      name: 'idx_matches_created_by'
    });

    await queryInterface.addIndex('matches', ['match_date_time'], {
      name: 'idx_matches_match_datetime'
    });

    await queryInterface.addIndex('matches', ['match_end_date_time'], {
      name: 'idx_matches_match_end_datetime'
    });

    await queryInterface.addIndex('matches', ['status', 'match_date_time'], {
      name: 'idx_matches_status_datetime'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('matches');
  }
};

