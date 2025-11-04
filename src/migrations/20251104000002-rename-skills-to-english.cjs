'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('user_profiles');
    
    // Renombrar columnas si existen con los nombres antiguos
    const columnRenames = [
      { old: 'skillSaque', new: 'skillServe' },
      { old: 'skillVolea', new: 'skillVolley' },
      { old: 'skillDerecha', new: 'skillForehand' },
      { old: 'skillPared', new: 'skillWall' },
      { old: 'skillRemate', new: 'skillSmash' },
      { old: 'skillAgilidad', new: 'skillAgility' }
    ];

    for (const rename of columnRenames) {
      if (tableDescription[rename.old] && !tableDescription[rename.new]) {
        await queryInterface.renameColumn('user_profiles', rename.old, rename.new);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('user_profiles');
    
    // Revertir renombres
    const columnRenames = [
      { old: 'skillServe', new: 'skillSaque' },
      { old: 'skillVolley', new: 'skillVolea' },
      { old: 'skillForehand', new: 'skillDerecha' },
      { old: 'skillWall', new: 'skillPared' },
      { old: 'skillSmash', new: 'skillRemate' },
      { old: 'skillAgility', new: 'skillAgilidad' }
    ];

    for (const rename of columnRenames) {
      if (tableDescription[rename.old] && !tableDescription[rename.new]) {
        await queryInterface.renameColumn('user_profiles', rename.old, rename.new);
      }
    }
  }
};

