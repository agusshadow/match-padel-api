'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar si ya existen cosméticos
    const cosmeticsCount = await queryInterface.sequelize.query(
      "SELECT COUNT(*) FROM cosmetics",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (parseInt(cosmeticsCount[0].count) > 0) {
      console.log('Ya existen cosméticos, omitiendo seeder');
      return;
    }

    await queryInterface.bulkInsert('cosmetics', [
      // Paleta GRATIS (1) - La genérica que se tiene al empezar
      {
        name: 'Paleta Base',
        description: 'Tu primera paleta. Perfecta para comenzar tu aventura en el pádel',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paleta-base.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Paleta por DESAFÍO (1)
      {
        name: 'Paleta Campeona',
        description: 'Obtén esta paleta completando el desafío "Racha de 3 victorias"',
        type: 'palette',
        imageUrl: 'https://tu-bucket.supabase.co/storage/v1/object/public/cosmetics/palette-champion.png',
        acquisitionMethod: 'challenge',
        price: null,
        challengeId: null, // Se actualizará después de crear los desafíos
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Paletas PAGAS
      {
        name: 'Paleta Adidas',
        description: 'Paleta premium de la marca Adidas. Diseño profesional y calidad superior',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paleta-adidas.svg',
        acquisitionMethod: 'purchase',
        price: 500.00,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('cosmetics', null, {});
  }
};

