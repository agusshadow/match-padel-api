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

    // Calcular experiencia y nivel
    // Fórmula: level = floor(sqrt(experience / 10)) + 1
    // Nivel 3: 40-89 XP
    // Nivel 4: 90-159 XP
    // Vamos a ponerlo en nivel 3 con 60 XP (cerca de subir a nivel 4)
    const currentExperience = 60;
    const currentLevel = Math.floor(Math.sqrt(currentExperience / 10)) + 1; // Debería ser nivel 3

    // Verificar si ya existe un UserLevel para este usuario
    const [existingLevels] = await queryInterface.sequelize.query(
      `SELECT id FROM user_levels WHERE "userId" = ${userId} LIMIT 1`
    );

    if (existingLevels.length > 0) {
      // Actualizar el existente
      await queryInterface.sequelize.query(
        `UPDATE user_levels 
         SET experience = ${currentExperience}, 
             level = ${currentLevel},
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "userId" = ${userId}`
      );
      console.log(`UserLevel actualizado para usuario ${userId}: ${currentExperience} XP, Nivel ${currentLevel}`);
    } else {
      // Crear nuevo UserLevel
      await queryInterface.bulkInsert('user_levels', [
        {
          userId: userId,
          experience: currentExperience,
          level: currentLevel,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      console.log(`UserLevel creado para usuario ${userId}: ${currentExperience} XP, Nivel ${currentLevel}`);
    }

    // Crear registros de experiencia para simular historial
    // Simular que jugó varios partidos (algunos ganados, algunos perdidos)
    const now = new Date();
    const experienceRecords = [
      {
        userId: userId,
        action: 'PLAY_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 1 }),
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Hace 7 días
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'WIN_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 1 }),
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'PLAY_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 2 }),
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // Hace 5 días
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'PLAY_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 3 }),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'WIN_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 3 }),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'PLAY_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 4 }),
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Hace 1 día
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      }
    ];

    // Eliminar registros existentes del usuario para evitar duplicados
    await queryInterface.sequelize.query(
      `DELETE FROM user_experience WHERE "userId" = ${userId}`
    );

    await queryInterface.bulkInsert('user_experience', experienceRecords);
    console.log(`✅ ${experienceRecords.length} registros de experiencia creados`);

    // Crear notificaciones de ejemplo
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Eliminar notificaciones existentes del usuario
    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE "userId" = ${userId}`
    );

    const notifications = [
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
        createdAt: weekAgo,
        updatedAt: weekAgo
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
        readAt: twoDaysAgo,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo
      },
      {
        userId: userId,
        type: 'MATCH_COMPLETED',
        data: JSON.stringify({
          matchId: 3,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        readAt: null,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
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
          matchId: 4,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        readAt: null,
        createdAt: yesterday,
        updatedAt: yesterday
      }
    ];

    await queryInterface.bulkInsert('notifications', notifications);
    console.log(`✅ ${notifications.length} notificaciones creadas`);

    console.log(`\n✅ Seeder completado para agustin@example.com:`);
    console.log(`   - UserLevel: Nivel ${currentLevel} con ${currentExperience} XP`);
    console.log(`   - UserExperience: ${experienceRecords.length} registros de historial`);
    console.log(`   - Notifications: ${notifications.length} notificaciones`);
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

    // Eliminar registros creados por este seeder
    await queryInterface.sequelize.query(
      `DELETE FROM user_experience WHERE "userId" = ${userId}`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE "userId" = ${userId}`
    );

    // Resetear UserLevel a valores por defecto
    await queryInterface.sequelize.query(
      `UPDATE user_levels 
       SET experience = 0, 
           level = 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = ${userId}`
    );

    console.log(`✅ Datos eliminados para agustin@example.com`);
  }
};

