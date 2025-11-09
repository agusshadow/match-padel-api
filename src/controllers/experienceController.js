import * as experienceService from '../services/experienceService.js';

// Obtener experiencia y nivel del usuario actual
const getMyExperience = async (req, res) => {
  try {
    const experience = await experienceService.getUserExperience(req.user.id);
    res.json({
      success: true,
      data: experience
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener historial de experiencia del usuario actual
const getMyExperienceHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await experienceService.getExperienceHistory(req.user.id, limit);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getMyExperience,
  getMyExperienceHistory
};

