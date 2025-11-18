'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('court_reservations');
    if (tableExists) {
      console.log('Tabla court_reservations ya existe, omitiendo creación');
      return;
    }

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
      scheduledDateTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      endDateTime: {
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

    await queryInterface.addIndex('court_reservations', ['scheduledDateTime'], {
      name: 'idx_reservations_scheduled_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['endDateTime'], {
      name: 'idx_reservations_end_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['slotId', 'scheduledDate', 'status'], {
      name: 'idx_reservations_slot_date_status'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_reservations');
  }
};

