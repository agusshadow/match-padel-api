'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('match_score_sets');
    if (tableExists) {
      console.log('Tabla match_score_sets ya existe, omitiendo creación');
      return;
    }

    await queryInterface.createTable('match_score_sets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      matchScoreId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'match_scores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      setNumber: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      team1Score: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      team2Score: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('match_score_sets', ['matchScoreId'], {
      name: 'idx_match_score_sets_match_score_id'
    });

    await queryInterface.addIndex('match_score_sets', ['setNumber'], {
      name: 'idx_match_score_sets_set_number'
    });

    await queryInterface.addIndex('match_score_sets', ['matchScoreId', 'setNumber'], {
      unique: true,
      name: 'idx_match_score_sets_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_score_sets');
  }
};

