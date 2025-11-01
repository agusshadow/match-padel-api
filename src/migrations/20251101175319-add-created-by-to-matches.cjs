'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar si existe created_by (snake_case) para renombrarlo
    const [results] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'matches' 
      AND COLUMN_NAME = 'created_by'
    `);
    
    if (results.length > 0) {
      // Si existe created_by, primero eliminar la foreign key constraint si existe
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE matches 
          DROP FOREIGN KEY matches_created_by_foreign_idx
        `);
      } catch (error) {
        // Ignorar error si la constraint no existe
      }
      
      // Renombrar created_by a createdBy
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        CHANGE COLUMN created_by createdBy INT
      `);
      
      // Agregar la foreign key constraint con el nuevo nombre
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        ADD CONSTRAINT matches_createdBy_fkey 
        FOREIGN KEY (createdBy) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      
      // Asegurar que sea NOT NULL
      await queryInterface.sequelize.query(`
        ALTER TABLE matches 
        MODIFY COLUMN createdBy INT NOT NULL
      `);
    } else {
      // Si no existe, crear createdBy desde cero
      await queryInterface.addColumn('matches', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });

      // Llenar el campo createdBy con los valores de player1Id para registros existentes
      await queryInterface.sequelize.query(`
        UPDATE matches 
        SET createdBy = player1Id 
        WHERE createdBy IS NULL
      `);

      // Ahora hacer el campo NOT NULL después de haberlo llenado
      await queryInterface.changeColumn('matches', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Verificar qué nombre tiene la columna y eliminarla
    const [results] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'matches' 
      AND COLUMN_NAME IN ('created_by', 'createdBy')
    `);
    
    if (results.length > 0) {
      const columnName = results[0].COLUMN_NAME;
      
      // Eliminar foreign key constraint primero
      try {
        if (columnName === 'createdBy') {
          await queryInterface.sequelize.query(`
            ALTER TABLE matches 
            DROP FOREIGN KEY matches_createdBy_fkey
          `);
        } else {
          await queryInterface.sequelize.query(`
            ALTER TABLE matches 
            DROP FOREIGN KEY matches_created_by_foreign_idx
          `);
        }
      } catch (error) {
        // Ignorar si no existe
      }
      
      // Eliminar la columna
      await queryInterface.removeColumn('matches', columnName);
    }
  }
};
