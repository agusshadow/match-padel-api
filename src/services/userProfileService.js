import UserProfile from '../models/UserProfile.js';

// Obtener perfil del usuario con estructura organizada
const getUserProfile = async (userId) => {
  let profile = await UserProfile.findOne({ 
    where: { user_id: userId },
    include: [
      {
        association: 'equippedPalette',
        required: false
      }
    ]
  });
  
  // Si no existe, crear uno vacío
  if (!profile) {
    profile = await UserProfile.create({ user_id: userId });
    // Recargar con la relación incluida
    profile = await UserProfile.findOne({ 
      where: { user_id: userId },
      include: [
        {
          association: 'equippedPalette',
          required: false
        }
      ]
    });
  }
  
  // Organizar la respuesta en objetos agrupados
  const profileData = profile.toJSON();
  
  return {
    id: profileData.id,
    userId: profileData.userId || profileData.user_id,
    personalInformation: {
      location: profileData.location,
      picture: profileData.picture,
      createdAt: profileData.createdAt || profileData.created_at,
      updatedAt: profileData.updatedAt || profileData.updated_at
    },
    gamePreferences: {
      favoritePosition: profileData.favoritePosition || profileData.favorite_position,
      gameStyle: profileData.gameStyle || profileData.game_style,
      dominantHand: profileData.dominantHand || profileData.dominant_hand
    },
    gameSkills: {
      skillServe: profileData.skillServe || profileData.skill_serve,
      skillVolley: profileData.skillVolley || profileData.skill_volley,
      skillForehand: profileData.skillForehand || profileData.skill_forehand,
      skillWall: profileData.skillWall || profileData.skill_wall,
      skillSmash: profileData.skillSmash || profileData.skill_smash,
      skillAgility: profileData.skillAgility || profileData.skill_agility
    },
    equippedPalette: profileData.equippedPalette || null,
    // Mantener campos legacy en camelCase para compatibilidad directa
    location: profileData.location,
    picture: profileData.picture,
    favoritePosition: profileData.favoritePosition || profileData.favorite_position,
    gameStyle: profileData.gameStyle || profileData.game_style,
    dominantHand: profileData.dominantHand || profileData.dominant_hand,
    skillServe: profileData.skillServe || profileData.skill_serve,
    skillVolley: profileData.skillVolley || profileData.skill_volley,
    skillForehand: profileData.skillForehand || profileData.skill_forehand,
    skillWall: profileData.skillWall || profileData.skill_wall,
    skillSmash: profileData.skillSmash || profileData.skill_smash,
    skillAgility: profileData.skillAgility || profileData.skill_agility
  };
};

// Crear o actualizar perfil del usuario
const createOrUpdateUserProfile = async (userId, profileData) => {
  // Mapear campos de camelCase a lo que espera Sequelize (o snake_case legacy si fuera necesario)
  // Aunque con underscored: true, Sequelize acepta camelCase para los campos.
  const mappedData = { ...profileData };
  
  // Normalizar habilidades y otros campos si vienen en snake_case desde algún origen legacy
  const fieldsToNormalize = [
    'skill_serve', 'skill_volley', 'skill_forehand', 'skill_wall', 'skill_smash', 'skill_agility',
    'favorite_position', 'game_style', 'dominant_hand'
  ];

  fieldsToNormalize.forEach(field => {
    if (mappedData[field] !== undefined) {
      const camelCaseField = field.replace(/_([a-z])/g, g => g[1].toUpperCase());
      mappedData[camelCaseField] = mappedData[field];
      delete mappedData[field];
    }
  });

  // Validar rangos de habilidades
  const skillFields = ['skillServe', 'skillVolley', 'skillForehand', 'skillWall', 'skillSmash', 'skillAgility'];
  
  for (const field of skillFields) {
    if (mappedData[field] !== undefined && mappedData[field] !== null) {
      const value = parseInt(mappedData[field]);
      if (isNaN(value) || value < 0 || value > 10) {
        throw new Error(`${field} debe ser un número entre 0 y 10`);
      }
      mappedData[field] = value === 0 ? null : value;
    }
  }

  // Buscar perfil existente
  let profile = await UserProfile.findOne({ where: { user_id: userId } });
  
  if (profile) {
    // Actualizar perfil existente
    await profile.update(mappedData);
    return profile.reload();
  } else {
    // Crear nuevo perfil
    return await UserProfile.create({ ...mappedData, userId });
  }
};

export {
  getUserProfile,
  createOrUpdateUserProfile
};
