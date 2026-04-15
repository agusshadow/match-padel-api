'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener todos los usuarios existentes
    const users = await queryInterface.sequelize.query(
      'SELECT id, name, email FROM users ORDER BY id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) {
      console.log('⚠️ No hay usuarios para crear perfiles');
      return;
    }

    // Función para generar URL de avatar de persona usando i.pravatar.cc
    const generateAvatarUrl = (name, seed) => {
      const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const imageId = ((hash + seed) % 70) + 1; // Rango 1-70
      return `https://i.pravatar.cc/300?img=${imageId}`;
    };

    // Verificar qué perfiles ya existen
    const existingProfiles = await queryInterface.sequelize.query(
      'SELECT user_id FROM user_profiles',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingUserIds = new Set(existingProfiles.map(p => p.user_id));

    // Preparar perfiles para insertar o actualizar
    const profilesToInsert = [];
    const profilesToUpdate = [];

    users.forEach((user, index) => {
      const avatarUrl = generateAvatarUrl(user.name, index);
      
      if (existingUserIds.has(user.id)) {
        // Actualizar perfil existente
        profilesToUpdate.push({
          user_id: user.id,
          picture: avatarUrl
        });
      } else {
        // Crear nuevo perfil
        profilesToInsert.push({
          user_id: user.id,
          picture: avatarUrl,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    // Insertar nuevos perfiles
    if (profilesToInsert.length > 0) {
      await queryInterface.bulkInsert('user_profiles', profilesToInsert, {});
      console.log(`✅ Creados ${profilesToInsert.length} perfiles nuevos`);
    }

    // Actualizar perfiles existentes
    if (profilesToUpdate.length > 0) {
      for (const profile of profilesToUpdate) {
        await queryInterface.sequelize.query(
          `UPDATE user_profiles SET picture = :picture, updated_at = NOW() WHERE user_id = :user_id`,
          {
            replacements: { picture: profile.picture, user_id: profile.user_id },
            type: queryInterface.sequelize.QueryTypes.RAW
          }
        );
      }
      console.log(`✅ Actualizados ${profilesToUpdate.length} perfiles existentes`);
    }

    console.log(`✅ Total: ${users.length} usuarios con avatares asignados`);
  },

  async down (queryInterface, Sequelize) {
    // Eliminar todas las imágenes de perfil (dejar los perfiles pero sin picture)
    await queryInterface.sequelize.query(
      `UPDATE user_profiles SET picture = NULL, updated_at = NOW()`,
      { type: queryInterface.sequelize.QueryTypes.RAW }
    );
    console.log('✅ Imágenes de perfil eliminadas');
  }
};
