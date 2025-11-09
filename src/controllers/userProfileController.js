import * as userProfileService from '../services/userProfileService.js';
import { uploadProfilePicture as uploadStorage } from '../services/storageService.js';

// Obtener mi perfil
const getMyProfile = async (req, res) => {
  try {
    const profile = await userProfileService.getUserProfile(req.user.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar mi perfil
const updateMyProfile = async (req, res) => {
  try {
    const profile = await userProfileService.createOrUpdateUserProfile(
      req.user.id,
      req.body
    );
    res.json({
      success: true,
      data: profile,
      message: 'Perfil actualizado correctamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Subir foto de perfil
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen'
      });
    }

    const imageUrl = await uploadStorage(req.user.id, req.file);
    
    const profile = await userProfileService.createOrUpdateUserProfile(
      req.user.id,
      { picture: imageUrl }
    );

    res.json({
      success: true,
      data: profile,
      message: 'Foto de perfil actualizada correctamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getMyProfile,
  updateMyProfile,
  uploadProfilePicture
};

