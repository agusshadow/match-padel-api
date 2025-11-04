'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // MySQL requiere eliminar y recrear el ENUM para cambiar valores
    // Primero obtener los valores actuales de la tabla
    const tableDescription = await queryInterface.describeTable('user_profiles');
    
    // Cambiar favoritePosition de español a inglés
    if (tableDescription.favoritePosition) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN favoritePosition ENUM('left', 'right') 
        COMMENT 'Posición favorita en la cancha'
      `);
      
      // Actualizar valores existentes
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET favoritePosition = 'left' WHERE favoritePosition = 'IZQUIERDA'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET favoritePosition = 'right' WHERE favoritePosition = 'DERECHA'
      `);
    }
    
    // Cambiar gameStyle de español a inglés
    if (tableDescription.gameStyle) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN gameStyle ENUM('offensive', 'defensive', 'balanced') 
        COMMENT 'Estilo de juego preferido'
      `);
      
      // Actualizar valores existentes
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'offensive' WHERE gameStyle = 'OFENSIVO'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'defensive' WHERE gameStyle = 'DEFENSIVO'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'balanced' WHERE gameStyle = 'EQUILIBRADO'
      `);
    }
    
    // Cambiar dominantHand de español a inglés
    if (tableDescription.dominantHand) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN dominantHand ENUM('left', 'right', 'ambidextrous') 
        COMMENT 'Mano hábil del usuario'
      `);
      
      // Actualizar valores existentes
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'left' WHERE dominantHand = 'IZQUIERDA'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'right' WHERE dominantHand = 'DERECHA'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'ambidextrous' WHERE dominantHand = 'AMBIDIESTRO'
      `);
    }
  },

  async down (queryInterface, Sequelize) {
    // Revertir cambios
    const tableDescription = await queryInterface.describeTable('user_profiles');
    
    if (tableDescription.favoritePosition) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN favoritePosition ENUM('IZQUIERDA', 'DERECHA') 
        COMMENT 'Posición favorita en la cancha'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET favoritePosition = 'IZQUIERDA' WHERE favoritePosition = 'left'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET favoritePosition = 'DERECHA' WHERE favoritePosition = 'right'
      `);
    }
    
    if (tableDescription.gameStyle) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN gameStyle ENUM('OFENSIVO', 'DEFENSIVO', 'EQUILIBRADO') 
        COMMENT 'Estilo de juego preferido'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'OFENSIVO' WHERE gameStyle = 'offensive'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'DEFENSIVO' WHERE gameStyle = 'defensive'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET gameStyle = 'EQUILIBRADO' WHERE gameStyle = 'balanced'
      `);
    }
    
    if (tableDescription.dominantHand) {
      await queryInterface.sequelize.query(`
        ALTER TABLE user_profiles 
        MODIFY COLUMN dominantHand ENUM('IZQUIERDA', 'DERECHA', 'AMBIDIESTRO') 
        COMMENT 'Mano hábil del usuario'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'IZQUIERDA' WHERE dominantHand = 'left'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'DERECHA' WHERE dominantHand = 'right'
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE user_profiles 
        SET dominantHand = 'AMBIDIESTRO' WHERE dominantHand = 'ambidextrous'
      `);
    }
  }
};

