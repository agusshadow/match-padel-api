'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('user_profiles');
    if (!tableExists) {
      console.log('Tabla user_profiles no existe, omitiendo modificación');
      return;
    }

    const columnExists = await queryInterface.describeTable('user_profiles')
      .then(columns => 'equippedPaletteId' in columns)
      .catch(() => false);

    if (columnExists) {
      console.log('Columna equippedPaletteId ya existe en user_profiles, omitiendo');
      return;
    }

    await queryInterface.addColumn('user_profiles', 'equippedPaletteId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'cosmetics',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID de la paleta equipada'
    });

    await queryInterface.addIndex('user_profiles', ['equippedPaletteId'], {
      name: 'idx_user_profiles_equipped_palette'
    });
  },

  async down (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('user_profiles');
    if (!tableExists) {
      return;
    }

    await queryInterface.removeIndex('user_profiles', 'idx_user_profiles_equipped_palette');
    await queryInterface.removeColumn('user_profiles', 'equippedPaletteId');
  }
};

