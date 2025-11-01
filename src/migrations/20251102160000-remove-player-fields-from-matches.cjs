'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Eliminar foreign keys primero
    await queryInterface.sequelize.query(`
      ALTER TABLE matches 
      DROP FOREIGN KEY matches_ibfk_2,
      DROP FOREIGN KEY matches_ibfk_3,
      DROP FOREIGN KEY matches_ibfk_4,
      DROP FOREIGN KEY matches_ibfk_5
    `).catch(() => {
      // Si las foreign keys tienen nombres diferentes, intentar con los nombres generados automáticamente
      console.log('Intentando eliminar foreign keys con nombres alternativos...');
    });

    // Eliminar índices asociados
    await queryInterface.removeIndex('matches', 'matches_player1Id').catch(() => {});
    await queryInterface.removeIndex('matches', 'matches_player2Id').catch(() => {});
    await queryInterface.removeIndex('matches', 'matches_player3Id').catch(() => {});
    await queryInterface.removeIndex('matches', 'matches_player4Id').catch(() => {});

    // Eliminar las columnas
    await queryInterface.removeColumn('matches', 'player1Id');
    await queryInterface.removeColumn('matches', 'player2Id');
    await queryInterface.removeColumn('matches', 'player3Id');
    await queryInterface.removeColumn('matches', 'player4Id');
  },

  async down (queryInterface, Sequelize) {
    // Restaurar las columnas
    await queryInterface.addColumn('matches', 'player1Id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('matches', 'player2Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('matches', 'player3Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('matches', 'player4Id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Restaurar datos desde los campos de equipos
    await queryInterface.sequelize.query(`
      UPDATE matches 
      SET 
        player1Id = team1Player1Id,
        player2Id = team1Player2Id,
        player3Id = team2Player1Id,
        player4Id = team2Player2Id
    `);
  }
};

