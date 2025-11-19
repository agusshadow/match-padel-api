import * as experienceService from '../services/experienceService.js';
import { successObject, successList, error } from '../utils/responseHelper.js';

// Obtener experiencia y nivel del usuario actual
const getMyExperience = async (req, res) => {
  try {
    const experience = await experienceService.getUserExperience(req.user.id);
    return successObject(res, experience);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener historial de experiencia del usuario actual
const getMyExperienceHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await experienceService.getExperienceHistory(req.user.id, limit);
    return successList(res, history);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getMyExperience,
  getMyExperienceHistory
};

