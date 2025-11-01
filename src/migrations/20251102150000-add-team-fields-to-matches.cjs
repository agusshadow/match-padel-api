'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar campos de equipos a la tabla matches
    await queryInterface.addColumn('matches', 'team1Player1Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Jugador 1 del equipo 1'
    });

    await queryInterface.addColumn('matches', 'team1Player2Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Jugador 2 del equipo 1'
    });

    await queryInterface.addColumn('matches', 'team2Player1Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Jugador 1 del equipo 2'
    });

    await queryInterface.addColumn('matches', 'team2Player2Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Jugador 2 del equipo 2'
    });

    // Migrar datos existentes: mapear player1-4 a los nuevos campos de equipos
    // team1Player1Id = player1Id
    // team1Player2Id = player2Id
    // team2Player1Id = player3Id
    // team2Player2Id = player4Id
    await queryInterface.sequelize.query(`
      UPDATE matches 
      SET 
        team1Player1Id = player1Id,
        team1Player2Id = player2Id,
        team2Player1Id = player3Id,
        team2Player2Id = player4Id
    `);

    // Crear índices para búsquedas rápidas
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
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices primero
    await queryInterface.removeIndex('matches', 'idx_matches_team2_player2');
    await queryInterface.removeIndex('matches', 'idx_matches_team2_player1');
    await queryInterface.removeIndex('matches', 'idx_matches_team1_player2');
    await queryInterface.removeIndex('matches', 'idx_matches_team1_player1');

    // Eliminar columnas
    await queryInterface.removeColumn('matches', 'team2Player2Id');
    await queryInterface.removeColumn('matches', 'team2Player1Id');
    await queryInterface.removeColumn('matches', 'team1Player2Id');
    await queryInterface.removeColumn('matches', 'team1Player1Id');
  }
};

