'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('match_scores', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      matchId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'matches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        unique: true // Un partido solo puede tener un score
      },
      winnerTeam: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          isIn: [[1, 2]]
        },
        comment: '1 = Team 1, 2 = Team 2'
      },
      status: {
        type: Sequelize.ENUM('pending_confirmation', 'confirmed', 'rejected'),
        defaultValue: 'pending_confirmation',
        allowNull: false
      },
      confirmedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Usuario del equipo contrario que confirmó el resultado'
      },
      rejectedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Usuario del equipo contrario que rechazó el resultado'
      },
      confirmationComment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rejectionComment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      confirmedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Índices
    await queryInterface.addIndex('match_scores', ['matchId'], {
      name: 'idx_match_scores_match_id',
      unique: true
    });
    await queryInterface.addIndex('match_scores', ['status'], {
      name: 'idx_match_scores_status'
    });
    await queryInterface.addIndex('match_scores', ['confirmedBy'], {
      name: 'idx_match_scores_confirmed_by'
    });
    await queryInterface.addIndex('match_scores', ['rejectedBy'], {
      name: 'idx_match_scores_rejected_by'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('match_scores');
  }
};

