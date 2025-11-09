'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Buscar el usuario agustin@example.com
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1`
    );

    if (users.length === 0) {
      console.log('Usuario agustin@example.com no encontrado. Ejecuta primero el seeder de usuarios.');
      return;
    }

    const userId = users[0].id;

    // Verificar si ya existen notificaciones para este usuario
    const [existingNotifications] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM notifications WHERE "userId" = ${userId}`
    );

    if (existingNotifications[0].count > 0) {
      console.log(`Ya existen notificaciones para el usuario ${userId}. Eliminando las existentes...`);
      await queryInterface.sequelize.query(
        `DELETE FROM notifications WHERE "userId" = ${userId}`
      );
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Crear notificaciones de ejemplo
    await queryInterface.bulkInsert('notifications', [
      {
        userId: userId,
        type: 'LEVEL_UP',
        data: JSON.stringify({
          newLevel: 2,
          previousLevel: 1,
          experience: 20,
          experienceToNextLevel: 380
        }),
        read: false,
        readAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        userId: userId,
        type: 'LEVEL_UP',
        data: JSON.stringify({
          newLevel: 3,
          previousLevel: 2,
          experience: 40,
          experienceToNextLevel: 360
        }),
        read: true,
        readAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday
      },
      {
        userId: userId,
        type: 'MATCH_COMPLETED',
        data: JSON.stringify({
          matchId: 123,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        readAt: null,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo
      },
      {
        userId: userId,
        type: 'ACHIEVEMENT',
        data: JSON.stringify({
          achievementId: 1,
          achievementName: 'Primera Victoria',
          description: 'Has ganado tu primer partido'
        }),
        read: true,
        readAt: weekAgo,
        createdAt: weekAgo,
        updatedAt: weekAgo
      },
      {
        userId: userId,
        type: 'MATCH_COMPLETED',
        data: JSON.stringify({
          matchId: 124,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        readAt: null,
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // Hace 3 horas
        updatedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000)
      }
    ]);

    console.log(`Seeder completado. Se crearon 5 notificaciones para el usuario agustin@example.com:`);
    console.log(`- 2 notificaciones de LEVEL_UP (1 no leída, 1 leída)`);
    console.log(`- 2 notificaciones de MATCH_COMPLETED (ambas no leídas)`);
    console.log(`- 1 notificación de ACHIEVEMENT (leída)`);
  },

  async down (queryInterface, Sequelize) {
    // Buscar el usuario agustin@example.com
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'agustin@example.com' LIMIT 1`
    );

    if (users.length === 0) {
      return;
    }

    const userId = users[0].id;

    // Eliminar todas las notificaciones del usuario
    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE "userId" = ${userId}`
    );

    console.log(`Notificaciones eliminadas para el usuario agustin@example.com`);
  }
};

