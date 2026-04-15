'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('clubs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      name: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      city: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      phone: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('clubs');
  }
};
