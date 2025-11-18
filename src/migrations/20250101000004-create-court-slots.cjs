'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('court_slots');
    if (tableExists) {
      console.log('Tabla court_slots ya existe, omitiendo creación');
      return;
    }

    await queryInterface.createTable('court_slots', {
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
      dayOfWeek: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: false
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false
      },
      isAvailable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.addIndex('court_slots', ['courtId'], {
      name: 'idx_court_slots_court_id'
    });

    await queryInterface.addIndex('court_slots', ['courtId', 'dayOfWeek', 'startTime'], {
      unique: true,
      name: 'idx_court_slots_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_slots');
  }
};

