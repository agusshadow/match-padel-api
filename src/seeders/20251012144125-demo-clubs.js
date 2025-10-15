'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('clubs', [
      {
        name: 'Club Pádel Central',
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        phone: '+54 11 1234-5678',
        description: 'Club de pádel con canchas de última generación y excelente iluminación.',
        latitude: -34.6037,
        longitude: -58.3816,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Pádel Norte',
        address: 'Av. Santa Fe 5678',
        city: 'Buenos Aires',
        phone: '+54 11 8765-4321',
        description: 'Centro deportivo especializado en pádel con canchas techadas.',
        latitude: -34.5895,
        longitude: -58.3974,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Club Deportivo Sur',
        address: 'Av. 9 de Julio 9999',
        city: 'Buenos Aires',
        phone: '+54 11 5555-1234',
        description: 'Complejo deportivo con múltiples canchas de pádel y servicios completos.',
        latitude: -34.6205,
        longitude: -58.3731,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('clubs', null, {});
  }
};
