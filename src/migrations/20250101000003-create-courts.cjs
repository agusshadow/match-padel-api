'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('courts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      club_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'clubs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('indoor', 'outdoor', 'covered'),
        allowNull: false
      },
      surface: {
        type: Sequelize.ENUM('synthetic', 'cement', 'grass'),
        allowNull: false
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

    await queryInterface.addIndex('courts', ['club_id'], {
      name: 'idx_courts_club_id'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('courts');
  }
};
