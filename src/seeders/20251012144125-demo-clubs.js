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
      },
      {
        name: 'Pádel Oeste',
        address: 'Av. Rivadavia 4567',
        city: 'Buenos Aires',
        phone: '+54 11 4444-8888',
        description: 'Club de pádel en zona oeste con canchas premium y servicios de primera.',
        latitude: -34.6100,
        longitude: -58.4000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mega Pádel Center',
        address: 'Av. Libertador 7890',
        city: 'Buenos Aires',
        phone: '+54 11 7777-9999',
        description: 'El centro de pádel más grande de la ciudad con 4 canchas profesionales y todas las comodidades.',
        latitude: -34.5800,
        longitude: -58.3900,
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
