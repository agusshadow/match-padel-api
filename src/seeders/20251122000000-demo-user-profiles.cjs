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
    // Este servicio genera fotos reales de personas (rango 1-70)
    const generateAvatarUrl = (name, seed) => {
      // Convertir el nombre y seed en un número entre 1 y 70
      // i.pravatar.cc tiene 70 fotos diferentes de personas reales
      const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const imageId = ((hash + seed) % 70) + 1; // Rango 1-70
      return `https://i.pravatar.cc/300?img=${imageId}`;
    };

    // Verificar qué perfiles ya existen
    const existingProfiles = await queryInterface.sequelize.query(
      'SELECT "userId" FROM user_profiles',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingUserIds = new Set(existingProfiles.map(p => p.userId));

    // Preparar perfiles para insertar o actualizar
    const profilesToInsert = [];
    const profilesToUpdate = [];

    users.forEach((user, index) => {
      const avatarUrl = generateAvatarUrl(user.name, index);
      
      if (existingUserIds.has(user.id)) {
        // Actualizar perfil existente
        profilesToUpdate.push({
          userId: user.id,
          picture: avatarUrl
        });
      } else {
        // Crear nuevo perfil
        profilesToInsert.push({
          userId: user.id,
          picture: avatarUrl,
          createdAt: new Date(),
          updatedAt: new Date()
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
          `UPDATE user_profiles SET picture = :picture, "updatedAt" = NOW() WHERE "userId" = :userId`,
          {
            replacements: { picture: profile.picture, userId: profile.userId },
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
      `UPDATE user_profiles SET picture = NULL, "updatedAt" = NOW()`,
      { type: queryInterface.sequelize.QueryTypes.RAW }
    );
    console.log('✅ Imágenes de perfil eliminadas');
  }
};

