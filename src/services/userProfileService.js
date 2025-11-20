import UserProfile from '../models/UserProfile.js';

// Obtener perfil del usuario con estructura organizada
const getUserProfile = async (userId) => {
  let profile = await UserProfile.findOne({ 
    where: { userId },
    include: [
      {
        association: 'equippedPalette',
        required: false
      }
    ]
  });
  
  // Si no existe, crear uno vacío
  if (!profile) {
    profile = await UserProfile.create({ userId });
    // Recargar con la relación incluida
    profile = await UserProfile.findOne({ 
      where: { userId },
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
    userId: profileData.userId,
    personalInformation: {
      location: profileData.location,
      picture: profileData.picture,
      createdAt: profileData.createdAt,
      updatedAt: profileData.updatedAt
    },
    gamePreferences: {
      favoritePosition: profileData.favoritePosition,
      gameStyle: profileData.gameStyle,
      dominantHand: profileData.dominantHand
    },
    gameSkills: {
      skillServe: profileData.skillServe,
      skillVolley: profileData.skillVolley,
      skillForehand: profileData.skillForehand,
      skillWall: profileData.skillWall,
      skillSmash: profileData.skillSmash,
      skillAgility: profileData.skillAgility
    },
    equippedPalette: profileData.equippedPalette || null
  };
};

// Crear o actualizar perfil del usuario
const createOrUpdateUserProfile = async (userId, profileData) => {
  // Validar rangos de habilidades si están presentes
  const skillFields = ['skillServe', 'skillVolley', 'skillForehand', 'skillWall', 'skillSmash', 'skillAgility'];
  
  for (const field of skillFields) {
    if (profileData[field] !== undefined && profileData[field] !== null) {
      const value = parseInt(profileData[field]);
      if (isNaN(value) || value < 1 || value > 10) {
        throw new Error(`${field} debe ser un número entre 1 y 10`);
      }
      profileData[field] = value;
    }
  }

  // Buscar perfil existente
  let profile = await UserProfile.findOne({ where: { userId } });
  
  if (profile) {
    // Actualizar perfil existente
    await profile.update(profileData);
    return profile.reload();
  } else {
    // Crear nuevo perfil
    return await UserProfile.create({ ...profileData, userId });
  }
};

export {
  getUserProfile,
  createOrUpdateUserProfile
};

