'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar campos denormalizados a court_reservations
    await queryInterface.addColumn('court_reservations', 'scheduledDateTime', {
      type: Sequelize.DATE,
      allowNull: true // Permitir null inicialmente para datos existentes
    });

    await queryInterface.addColumn('court_reservations', 'endDateTime', {
      type: Sequelize.DATE,
      allowNull: true // Permitir null inicialmente para datos existentes
    });

    await queryInterface.addColumn('court_reservations', 'price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true // Permitir null inicialmente para datos existentes
    });

    // Cambiar slotId a NOT NULL (después de backfill)
    // Primero hacemos backfill de los datos existentes
    // Luego en otra migración lo hacemos NOT NULL

    // Agregar índices para queries temporales
    await queryInterface.addIndex('court_reservations', ['scheduledDateTime'], {
      name: 'idx_reservations_scheduled_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['endDateTime'], {
      name: 'idx_reservations_end_datetime'
    });

    await queryInterface.addIndex('court_reservations', ['slotId', 'scheduledDate', 'status'], {
      name: 'idx_reservations_slot_date_status'
    });

    // Backfill: Llenar campos denormalizados para datos existentes
    // Esto se hace con una query SQL que combina scheduledDate + slot.startTime
    await queryInterface.sequelize.query(`
      UPDATE court_reservations cr
      SET 
        "scheduledDateTime" = (
          SELECT (cr."scheduledDate"::date + cs."startTime"::time)::timestamp
          FROM court_slots cs
          WHERE cs.id = cr."slotId"
        ),
        "endDateTime" = (
          SELECT (cr."scheduledDate"::date + cs."endTime"::time)::timestamp
          FROM court_slots cs
          WHERE cs.id = cr."slotId"
        ),
        "price" = (
          SELECT cs.price
          FROM court_slots cs
          WHERE cs.id = cr."slotId"
        )
      WHERE cr."slotId" IS NOT NULL;
    `);
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices
    await queryInterface.removeIndex('court_reservations', 'idx_reservations_slot_date_status');
    await queryInterface.removeIndex('court_reservations', 'idx_reservations_end_datetime');
    await queryInterface.removeIndex('court_reservations', 'idx_reservations_scheduled_datetime');

    // Eliminar columnas
    await queryInterface.removeColumn('court_reservations', 'price');
    await queryInterface.removeColumn('court_reservations', 'endDateTime');
    await queryInterface.removeColumn('court_reservations', 'scheduledDateTime');
  }
};
