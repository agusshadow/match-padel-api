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
    const currentExperience = 60;
    const currentLevel = Math.floor(Math.sqrt(currentExperience / 10)) + 1; // Debería ser nivel 3

    // Verificar si ya existe un UserLevel para este usuario
    const [existingLevels] = await queryInterface.sequelize.query(
      `SELECT id FROM user_levels WHERE user_id = ${userId} LIMIT 1`
    );

    if (existingLevels.length > 0) {
      // Actualizar el existente
      await queryInterface.sequelize.query(
        `UPDATE user_levels 
         SET experience = ${currentExperience}, 
             level = ${currentLevel},
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ${userId}`
      );
      console.log(`UserLevel actualizado para usuario ${userId}: ${currentExperience} XP, Nivel ${currentLevel}`);
    } else {
      // Crear nuevo UserLevel
      await queryInterface.bulkInsert('user_levels', [
        {
          user_id: userId,
          experience: currentExperience,
          level: currentLevel,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
      console.log(`UserLevel creado para usuario ${userId}: ${currentExperience} XP, Nivel ${currentLevel}`);
    }

    // Crear registros de experiencia para simular historial
    const now = new Date();
    const experienceRecords = [
      {
        user_id: userId,
        action: 'PLAY_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 1 }),
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Hace 7 días
        updated_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        action: 'WIN_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 1 }),
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        action: 'PLAY_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 2 }),
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // Hace 5 días
        updated_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        action: 'PLAY_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 3 }),
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
        updated_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        action: 'WIN_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 3 }),
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        action: 'PLAY_MATCH',
        xp_amount: 10,
        metadata: JSON.stringify({ matchId: 4 }),
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Hace 1 día
        updated_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      }
    ];

    // Eliminar registros existentes del usuario para evitar duplicados
    await queryInterface.sequelize.query(
      `DELETE FROM user_experience WHERE user_id = ${userId}`
    );

    await queryInterface.bulkInsert('user_experience', experienceRecords);
    console.log(`✅ ${experienceRecords.length} registros de experiencia creados`);

    // Crear notificaciones de ejemplo
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Eliminar notificaciones existentes del usuario
    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE user_id = ${userId}`
    );

    const notifications = [
      {
        user_id: userId,
        type: 'LEVEL_UP',
        data: JSON.stringify({
          newLevel: 2,
          previousLevel: 1,
          experience: 20,
          experienceToNextLevel: 380
        }),
        read: false,
        read_at: null,
        created_at: weekAgo,
        updated_at: weekAgo
      },
      {
        user_id: userId,
        type: 'LEVEL_UP',
        data: JSON.stringify({
          newLevel: 3,
          previousLevel: 2,
          experience: 40,
          experienceToNextLevel: 360
        }),
        read: true,
        read_at: twoDaysAgo,
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo
      },
      {
        user_id: userId,
        type: 'MATCH_COMPLETED',
        data: JSON.stringify({
          matchId: 3,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        read_at: null,
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user_id: userId,
        type: 'ACHIEVEMENT',
        data: JSON.stringify({
          achievementId: 1,
          achievementName: 'Primera Victoria',
          description: 'Has ganado tu primer partido'
        }),
        read: true,
        read_at: weekAgo,
        created_at: weekAgo,
        updated_at: weekAgo
      },
      {
        user_id: userId,
        type: 'MATCH_COMPLETED',
        data: JSON.stringify({
          matchId: 4,
          message: 'Tu partido ha sido completado'
        }),
        read: false,
        read_at: null,
        created_at: yesterday,
        updated_at: yesterday
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
      `DELETE FROM user_experience WHERE user_id = ${userId}`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE user_id = ${userId}`
    );

    // Resetear UserLevel a valores por defecto
    await queryInterface.sequelize.query(
      `UPDATE user_levels 
       SET experience = 0, 
           level = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ${userId}`
    );

    console.log(`✅ Datos eliminados para agustin@example.com`);
  }
};
