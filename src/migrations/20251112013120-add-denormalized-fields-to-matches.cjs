'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar campos denormalizados a matches
    await queryInterface.addColumn('matches', 'matchDateTime', {
      type: Sequelize.DATE,
      allowNull: true // Permitir null inicialmente para datos existentes
    });

    await queryInterface.addColumn('matches', 'matchEndDateTime', {
      type: Sequelize.DATE,
      allowNull: true // Permitir null inicialmente para datos existentes
    });

    // Cambiar team1Player1Id a NOT NULL (después de backfill)
    // Primero hacemos backfill

    // Agregar campos de auditoría
    await queryInterface.addColumn('matches', 'startedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('matches', 'finishedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('matches', 'cancelledAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('matches', 'cancelledBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Agregar constraint para reservationId UNIQUE
    await queryInterface.addIndex('matches', ['reservationId'], {
      unique: true,
      name: 'idx_matches_reservation_unique'
    });

    // Agregar índices para queries temporales
    await queryInterface.addIndex('matches', ['matchDateTime'], {
      name: 'idx_matches_match_datetime'
    });

    await queryInterface.addIndex('matches', ['matchEndDateTime'], {
      name: 'idx_matches_match_end_datetime'
    });

    await queryInterface.addIndex('matches', ['status', 'matchDateTime'], {
      name: 'idx_matches_status_datetime'
    });

    // Backfill: Llenar campos denormalizados para datos existentes
    await queryInterface.sequelize.query(`
      UPDATE matches m
      SET 
        "matchDateTime" = (
          SELECT cr."scheduledDateTime"
          FROM court_reservations cr
          WHERE cr.id = m."reservationId"
        ),
        "matchEndDateTime" = (
          SELECT cr."endDateTime"
          FROM court_reservations cr
          WHERE cr.id = m."reservationId"
        )
      WHERE m."reservationId" IS NOT NULL;
    `);

    // Backfill: Asegurar que team1Player1Id tenga valor (usar createdBy si es null)
    await queryInterface.sequelize.query(`
      UPDATE matches
      SET "team1Player1Id" = "createdBy"
      WHERE "team1Player1Id" IS NULL;
    `);
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices
    await queryInterface.removeIndex('matches', 'idx_matches_status_datetime');
    await queryInterface.removeIndex('matches', 'idx_matches_match_end_datetime');
    await queryInterface.removeIndex('matches', 'idx_matches_match_datetime');
    await queryInterface.removeIndex('matches', 'idx_matches_reservation_unique');

    // Eliminar columnas
    await queryInterface.removeColumn('matches', 'cancelledBy');
    await queryInterface.removeColumn('matches', 'cancelledAt');
    await queryInterface.removeColumn('matches', 'finishedAt');
    await queryInterface.removeColumn('matches', 'startedAt');
    await queryInterface.removeColumn('matches', 'matchEndDateTime');
    await queryInterface.removeColumn('matches', 'matchDateTime');
  }
};
