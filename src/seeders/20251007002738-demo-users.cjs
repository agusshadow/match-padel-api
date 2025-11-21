'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Limpiar usuarios existentes primero
    await queryInterface.bulkDelete('users', null, {});
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await queryInterface.bulkInsert('users', [
      {
        name: 'Agustin Gonzalez',
        email: 'agustin@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Admin Sistema',
        email: 'admin@example.com',
        password: adminPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'María Rodriguez',
        email: 'maria@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Carlos López',
        email: 'carlos@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Ana Martínez',
        email: 'ana@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Diego Fernández',
        email: 'diego@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Laura García',
        email: 'laura@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Roberto Silva',
        email: 'roberto@example.com',
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
