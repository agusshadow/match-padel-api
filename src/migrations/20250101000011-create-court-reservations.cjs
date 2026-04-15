'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Asegurar que la extensión btree_gist esté disponible para exclusion constraints
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');

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

    // Restricción de exclusión para evitar solapamientos (Exclusion Constraint)
    // Solo aplica para reservas que NO estén canceladas
    await queryInterface.sequelize.query(`
      ALTER TABLE court_reservations
      ADD CONSTRAINT no_overlapping_reservations
      EXCLUDE USING gist (
        court_id WITH =,
        tstzrange(scheduled_date_time, end_date_time) WITH &&
      )
      WHERE (status != 'cancelled');
    `);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_reservations');
  }
};

