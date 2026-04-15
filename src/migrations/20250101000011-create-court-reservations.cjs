'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('court_reservations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      court_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'courts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      scheduled_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      slot_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'court_slots',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      scheduled_date_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_date_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
        defaultValue: 'pending',
        allowNull: false
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

    await queryInterface.addIndex('court_reservations', ['court_id'], {
      name: 'idx_court_reservations_court_id'
    });

    await queryInterface.addIndex('court_reservations', ['user_id'], {
      name: 'idx_court_reservations_user_id'
    });

    await queryInterface.addIndex('court_reservations', ['slot_id'], {
      name: 'idx_court_reservations_slot_id'
    });

    await queryInterface.addIndex('court_reservations', ['scheduled_date_time'], {
      name: 'idx_reservations_scheduled_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['end_date_time'], {
      name: 'idx_reservations_end_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['slot_id', 'scheduled_date', 'status'], {
      name: 'idx_reservations_slot_date_status'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_reservations');
  }
};

