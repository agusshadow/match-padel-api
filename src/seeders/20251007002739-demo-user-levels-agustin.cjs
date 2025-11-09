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

    // Calcular experiencia para estar a un partido ganado de subir de nivel
    // Un partido ganado da: 20 XP (10 por jugar + 10 por ganar)
    // Fórmula: level = floor(sqrt(experience / 10)) + 1
    // 
    // Si tiene 20 XP (nivel 2) y gana un partido (20 XP más = 40 XP total), sube a nivel 3
    // Nivel 2: 10-39 XP
    // Nivel 3: 40-89 XP
    // 
    // Configuramos con 20 XP (nivel 2), así al ganar un partido sube a nivel 3

    const currentExperience = 20;
    const currentLevel = Math.floor(Math.sqrt(currentExperience / 10)) + 1; // Debería ser nivel 2

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

    // Crear algunos registros de experiencia para simular historial
    // Simular que jugó 2 partidos (uno ganado, uno perdido)
    await queryInterface.bulkInsert('user_experience', [
      {
        userId: userId,
        action: 'PLAY_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 999 }),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userId,
        action: 'WIN_MATCH',
        xpAmount: 10,
        metadata: JSON.stringify({ matchId: 999 }),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`Seeder completado. Usuario agustin@example.com está en Nivel ${currentLevel} con ${currentExperience} XP.`);
    console.log(`Al ganar un partido (20 XP más), subirá a Nivel ${Math.floor(Math.sqrt((currentExperience + 20) / 10)) + 1}`);
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

    // Eliminar registros de experiencia creados por este seeder
    await queryInterface.sequelize.query(
      `DELETE FROM user_experience WHERE "userId" = ${userId} AND metadata::text LIKE '%"matchId":999%'`
    );

    // Resetear UserLevel a valores por defecto
    await queryInterface.sequelize.query(
      `UPDATE user_levels 
       SET experience = 0, 
           level = 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = ${userId}`
    );
  }
};

