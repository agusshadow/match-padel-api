'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_experience', {
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
      action: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      xp_amount: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('user_experience', ['user_id'], {
      name: 'user_experience_user_id_idx'
    });

    await queryInterface.addIndex('user_experience', ['action'], {
      name: 'user_experience_action_idx'
    });

    await queryInterface.addIndex('user_experience', ['user_id', 'action'], {
      name: 'user_experience_user_id_action_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_experience');
  }
};
