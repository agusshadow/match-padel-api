'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🔄 Buscando usuario agustin...');
      
      // Buscar el usuario agustin
      const users = await queryInterface.sequelize.query(
        "SELECT id, email FROM users WHERE email = 'agustin@example.com'",
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!users || users.length === 0) {
        console.log('❌ Usuario agustin@example.com no encontrado');
        return;
      }

      const user = users[0];
      console.log(`✅ Usuario encontrado: ${user.email} (ID: ${user.id})`);

      // Buscar desafíos activos del usuario que sean de tipo WIN_MATCH
      const now = new Date();
      const userChallenges = await queryInterface.sequelize.query(`
        SELECT 
          uc.id,
          uc."userId",
          uc."challengeId",
          uc.progress,
          uc.status,
          c."targetValue",
          c.title,
          c.type
        FROM user_challenges uc
        INNER JOIN challenges c ON uc."challengeId" = c.id
        WHERE uc."userId" = :userId
          AND uc.status = 'pending'
          AND uc."expiresAt" > :now
          AND c."actionType" = 'WIN_MATCH'
          AND c."isActive" = true
      `, {
        replacements: { userId: user.id, now: now.toISOString() },
        type: Sequelize.QueryTypes.SELECT
      });

      if (!userChallenges || userChallenges.length === 0) {
        console.log('⚠️ No se encontraron desafíos activos de tipo WIN_MATCH para este usuario');
        return;
      }

      console.log(`🔄 Encontrados ${userChallenges.length} desafíos de tipo WIN_MATCH`);
      console.log('🔄 Simulando partido ganado...');

      let completedCount = 0;

      // Actualizar progreso de cada desafío
      for (const userChallenge of userChallenges) {
        const newProgress = userChallenge.progress + 1;
        const isCompleted = newProgress >= userChallenge.targetValue;

        // Actualizar progreso
        await queryInterface.sequelize.query(`
          UPDATE user_challenges
          SET 
            progress = :newProgress,
            status = :status,
            "completedAt" = :completedAt,
            "updatedAt" = :updatedAt
          WHERE id = :id
        `, {
          replacements: {
            id: userChallenge.id,
            newProgress: newProgress,
            status: isCompleted ? 'completed' : 'pending',
            completedAt: isCompleted ? now.toISOString() : null,
            updatedAt: now.toISOString()
          }
        });

        if (isCompleted) {
          completedCount++;
          console.log(`  ✅ Completado: ${userChallenge.title} (${userChallenge.type}) - Progreso: ${newProgress}/${userChallenge.targetValue}`);
        } else {
          console.log(`  📈 Progreso: ${userChallenge.title} (${userChallenge.type}) - Progreso: ${newProgress}/${userChallenge.targetValue}`);
        }
      }

      console.log(`✅ Partido ganado simulado. Desafíos completados: ${completedCount} de ${userChallenges.length}`);

    } catch (error) {
      console.error('❌ Error en seeder:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // No hay rollback para este seeder temporal
    console.log('⚠️ No se puede revertir la simulación de partido ganado');
  }
};

