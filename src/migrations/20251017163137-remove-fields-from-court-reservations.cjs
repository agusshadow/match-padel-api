'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Eliminar las columnas startTime, endTime y totalPrice de court_reservations
    // porque estos datos ahora se obtienen de court_slots a través de la relación
    
    await queryInterface.removeColumn('court_reservations', 'startTime');
    await queryInterface.removeColumn('court_reservations', 'endTime');
    await queryInterface.removeColumn('court_reservations', 'totalPrice');
    
    console.log('Columnas startTime, endTime y totalPrice eliminadas de court_reservations');
  },

  async down (queryInterface, Sequelize) {
    // Revertir: agregar las columnas de vuelta
    await queryInterface.addColumn('court_reservations', 'startTime', {
      type: Sequelize.TIME,
      allowNull: true
    });
    
    await queryInterface.addColumn('court_reservations', 'endTime', {
      type: Sequelize.TIME,
      allowNull: true
    });
    
    await queryInterface.addColumn('court_reservations', 'totalPrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });
    
    console.log('Columnas startTime, endTime y totalPrice restauradas en court_reservations');
  }
};
