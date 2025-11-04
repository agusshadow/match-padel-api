import UserProfile from '../models/UserProfile.js';

// Obtener perfil del usuario
const getUserProfile = async (userId) => {
  let profile = await UserProfile.findOne({ where: { userId } });
  
  // Si no existe, crear uno vacío
  if (!profile) {
    profile = await UserProfile.create({ userId });
  }
  
  return profile;
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

