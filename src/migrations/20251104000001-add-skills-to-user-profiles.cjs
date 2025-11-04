'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar si la columna dominantHand existe, si no, agregarla
    const tableDescription = await queryInterface.describeTable('user_profiles');
    
    if (!tableDescription.dominantHand) {
      await queryInterface.addColumn('user_profiles', 'dominantHand', {
        type: Sequelize.ENUM('left', 'right', 'ambidextrous'),
        allowNull: true,
        comment: 'Mano hábil del usuario'
      });
    }

    // Agregar campos de habilidades si no existen
    const skills = [
      { name: 'skillServe', comment: 'Nivel de saque (1-10)' },
      { name: 'skillVolley', comment: 'Nivel de volea (1-10)' },
      { name: 'skillForehand', comment: 'Nivel de derecha (1-10)' },
      { name: 'skillWall', comment: 'Nivel de pared (1-10)' },
      { name: 'skillSmash', comment: 'Nivel de remate (1-10)' },
      { name: 'skillAgility', comment: 'Nivel de agilidad (1-10)' }
    ];

    for (const skill of skills) {
      if (!tableDescription[skill.name]) {
        await queryInterface.addColumn('user_profiles', skill.name, {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: skill.comment
        });
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Eliminar las columnas agregadas
    await queryInterface.removeColumn('user_profiles', 'dominantHand');
    await queryInterface.removeColumn('user_profiles', 'skillServe');
    await queryInterface.removeColumn('user_profiles', 'skillVolley');
    await queryInterface.removeColumn('user_profiles', 'skillForehand');
    await queryInterface.removeColumn('user_profiles', 'skillWall');
    await queryInterface.removeColumn('user_profiles', 'skillSmash');
    await queryInterface.removeColumn('user_profiles', 'skillAgility');
  }
};

