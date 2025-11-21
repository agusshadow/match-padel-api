'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('matches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      reservationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'court_reservations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      team1Player1Id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      team1Player2Id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      team2Player1Id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      team2Player2Id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'pending_confirmation', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
        allowNull: false
      },
      matchDateTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      matchEndDateTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      finishedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelledBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notes: {
        type: Sequelize.TEXT,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('matches', ['reservationId'], {
      unique: true,
      name: 'idx_matches_reservation_unique'
    });

    await queryInterface.addIndex('matches', ['createdBy'], {
      name: 'idx_matches_created_by'
    });

    await queryInterface.addIndex('matches', ['team1Player1Id'], {
      name: 'idx_matches_team1_player1'
    });

    await queryInterface.addIndex('matches', ['team1Player2Id'], {
      name: 'idx_matches_team1_player2'
    });

    await queryInterface.addIndex('matches', ['team2Player1Id'], {
      name: 'idx_matches_team2_player1'
    });

    await queryInterface.addIndex('matches', ['team2Player2Id'], {
      name: 'idx_matches_team2_player2'
    });

    await queryInterface.addIndex('matches', ['matchDateTime'], {
      name: 'idx_matches_match_datetime'
    });

    await queryInterface.addIndex('matches', ['matchEndDateTime'], {
      name: 'idx_matches_match_end_datetime'
    });

    await queryInterface.addIndex('matches', ['status', 'matchDateTime'], {
      name: 'idx_matches_status_datetime'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('matches');
  }
};

