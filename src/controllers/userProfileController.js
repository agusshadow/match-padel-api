import * as userProfileService from '../services/userProfileService.js';
import { uploadProfilePicture as uploadStorage } from '../services/storageService.js';
import { successObject, error } from '../utils/responseHelper.js';

// Obtener mi perfil
const getMyProfile = async (req, res) => {
  try {
    const profile = await userProfileService.getUserProfile(req.user.id);
    return successObject(res, profile);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar mi perfil
const updateMyProfile = async (req, res) => {
  try {
    const profile = await userProfileService.createOrUpdateUserProfile(
      req.user.id,
      req.body
    );
    return successObject(res, profile, 200, 'Perfil actualizado correctamente');
  } catch (err) {
    return error(res, err.message, 400, 'VALIDATION_ERROR');
  }
};

// Subir foto de perfil
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, 'No se proporcionó ninguna imagen', 400, 'VALIDATION_ERROR');
    }

    const imageUrl = await uploadStorage(req.user.id, req.file);
    
    const profile = await userProfileService.createOrUpdateUserProfile(
      req.user.id,
      { picture: imageUrl }
    );

    return successObject(res, profile, 200, 'Foto de perfil actualizada correctamente');
  } catch (err) {
    return error(res, err.message, 400, 'VALIDATION_ERROR');
  }
};

export {
  getMyProfile,
  updateMyProfile,
  uploadProfilePicture
};

