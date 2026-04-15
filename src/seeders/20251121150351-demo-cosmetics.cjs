'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('cosmetics', [
      {
        name: 'Paleta Adidas',
        description: 'Paleta de padel de la marca Adidas',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-adidas.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Paleta Bullpadel',
        description: 'Paleta de padel de la marca Bullpadel',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-bullpadel.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Paleta Head',
        description: 'Paleta de padel de la marca Head',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-head.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Paleta MatchPadel',
        description: 'Paleta de padel oficial de MatchPadel',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-matchpadel-2.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Paleta Wilson',
        description: 'Paleta de padel de la marca Wilson',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta-wilson.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Paleta Clásica',
        description: 'Paleta de padel clásica',
        type: 'palette',
        image_url: 'https://fsyrlranrtkrnovmlvja.supabase.co/storage/v1/object/public/cosmetics/paletas/paleta.svg',
        acquisition_method: 'free',
        price: null,
        challenge_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('cosmetics', null, {});
  }
};
