'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_experience', {
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
      action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      xpAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 0
        }
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional context for the action (e.g., matchId)'
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
    await queryInterface.addIndex('user_experience', ['userId'], {
      name: 'user_experience_userId_idx'
    });

    await queryInterface.addIndex('user_experience', ['action'], {
      name: 'user_experience_action_idx'
    });

    await queryInterface.addIndex('user_experience', ['userId', 'action'], {
      name: 'user_experience_userId_action_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_experience');
  }
};

