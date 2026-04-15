'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('court_slots', {
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
      day_of_week: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      start_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      end_time: {
        type: Sequelize.TIME,
        allowNull: false
      },
      is_available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.addIndex('court_slots', ['court_id'], {
      name: 'idx_court_slots_court_id'
    });

    await queryInterface.addIndex('court_slots', ['court_id', 'day_of_week', 'start_time'], {
      unique: true,
      name: 'idx_court_slots_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('court_slots');
  }
};
