'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('match_participants', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      match_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'matches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      team_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      position: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('match_participants', ['match_id', 'user_id'], {
      unique: true,
      name: 'idx_match_participants_unique_user'
    });

    await queryInterface.addIndex('match_participants', ['user_id'], {
      name: 'idx_match_participants_user_id'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_participants');
  }
};
