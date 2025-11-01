'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar si existe created_by y renombrarlo a createdBy
    const [results] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'matches' 
      AND COLUMN_NAME = 'created_by'
    `);
    
    if (results.length > 0) {
      // Eliminar foreign key constraint si existe
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE matches 
          DROP FOREIGN KEY matches_created_by_foreign_idx
        `);
      } catch (error) {
        // Ignorar si no existe
      }
      
      // Renombrar created_by a createdBy
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        CHANGE COLUMN created_by createdBy INT NOT NULL
      `);
      
      // Agregar foreign key constraint con el nuevo nombre
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        ADD CONSTRAINT matches_createdBy_fkey 
        FOREIGN KEY (createdBy) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    }
    // Si ya es createdBy, no hacer nada
  },

  async down (queryInterface, Sequelize) {
    // Verificar si existe createdBy y renombrarlo a created_by
    const [results] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'matches' 
      AND COLUMN_NAME = 'createdBy'
    `);
    
    if (results.length > 0) {
      // Eliminar foreign key constraint
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE matches 
          DROP FOREIGN KEY matches_createdBy_fkey
        `);
      } catch (error) {
        // Ignorar si no existe
      }
      
      // Renombrar createdBy a created_by
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        CHANGE COLUMN createdBy created_by INT NOT NULL
      `);
      
      // Agregar foreign key constraint con el nombre original
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        ADD CONSTRAINT matches_created_by_foreign_idx 
        FOREIGN KEY (created_by) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    }
  }
};
