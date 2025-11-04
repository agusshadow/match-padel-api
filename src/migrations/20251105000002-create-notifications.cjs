'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      type: {
        type: Sequelize.ENUM('LEVEL_UP', 'ACHIEVEMENT', 'MATCH_COMPLETED'),
        allowNull: false
      },
      data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional data for the notification (e.g., levelUp info)'
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índices para mejorar performance
    await queryInterface.addIndex('notifications', ['userId'], {
      name: 'notifications_userId_idx'
    });

    await queryInterface.addIndex('notifications', ['read'], {
      name: 'notifications_read_idx'
    });

    await queryInterface.addIndex('notifications', ['userId', 'read'], {
      name: 'notifications_userId_read_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  }
};

