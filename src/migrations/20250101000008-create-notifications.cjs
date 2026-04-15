'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
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
      type: {
        type: Sequelize.ENUM('LEVEL_UP', 'ACHIEVEMENT', 'MATCH_COMPLETED'),
        allowNull: false
      },
      data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      read_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('notifications', ['user_id'], {
      name: 'notifications_user_id_idx'
    });

    await queryInterface.addIndex('notifications', ['read'], {
      name: 'notifications_read_idx'
    });

    await queryInterface.addIndex('notifications', ['user_id', 'read'], {
      name: 'notifications_user_id_read_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  }
};
