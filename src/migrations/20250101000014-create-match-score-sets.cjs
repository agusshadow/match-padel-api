'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('match_score_sets', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      match_score_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'match_scores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      set_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      team1_score: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      team2_score: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('match_score_sets', ['match_score_id'], {
      name: 'idx_match_score_sets_match_score_id'
    });

    await queryInterface.addIndex('match_score_sets', ['set_number'], {
      name: 'idx_match_score_sets_set_number'
    });

    await queryInterface.addIndex('match_score_sets', ['match_score_id', 'set_number'], {
      unique: true,
      name: 'idx_match_score_sets_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_score_sets');
  }
};

