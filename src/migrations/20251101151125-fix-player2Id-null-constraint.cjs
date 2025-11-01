'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Usar SQL directo para modificar la columna player2Id y permitir NULL
    // Esto es más confiable que changeColumn en MySQL
    await queryInterface.sequelize.query(
      `ALTER TABLE matches 
       MODIFY COLUMN player2Id INT(11) NULL,
       MODIFY COLUMN player3Id INT(11) NULL,
       MODIFY COLUMN player4Id INT(11) NULL`
    );
    
    console.log('Columna player2Id modificada para permitir NULL');
  },

  async down (queryInterface, Sequelize) {
    // Revertir: hacer que player2Id sea requerido nuevamente
    await queryInterface.sequelize.query(
      `ALTER TABLE matches 
       MODIFY COLUMN player2Id INT(11) NOT NULL`
    );
    
    console.log('Columna player2Id revertida para requerir NOT NULL');
  }
};
