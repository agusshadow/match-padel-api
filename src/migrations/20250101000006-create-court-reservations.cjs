'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('court_reservations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      courtId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'courts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      scheduledDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      slotId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'court_slots',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
        defaultValue: 'pending',
        allowNull: false
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

    await queryInterface.addIndex('court_reservations', ['courtId'], {
      name: 'idx_court_reservations_court_id'
    });

    await queryInterface.addIndex('court_reservations', ['userId'], {
      name: 'idx_court_reservations_user_id'
    });

    await queryInterface.addIndex('court_reservations', ['slotId'], {
      name: 'idx_court_reservations_slot_id'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_reservations');
  }
};

