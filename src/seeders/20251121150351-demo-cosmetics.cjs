'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('cosmetics', [
      {
        name: 'Paleta Adidas',
        description: 'Paleta de padel de la marca Adidas',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-adidas.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Paleta Bullpadel',
        description: 'Paleta de padel de la marca Bullpadel',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-bullpadel.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Paleta Head',
        description: 'Paleta de padel de la marca Head',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-head.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Paleta MatchPadel',
        description: 'Paleta de padel oficial de MatchPadel',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-matchpadel.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Paleta Wilson',
        description: 'Paleta de padel de la marca Wilson',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-wilson.svg',
        acquisitionMethod: 'free',
        price: null,
        challengeId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Paleta Clásica',
        description: 'Paleta de padel clásica',
        type: 'palette',
        imageUrl: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta.svg',
        acquisitionMethod: 'free',
        price: null,
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

