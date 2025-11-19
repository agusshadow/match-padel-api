import * as cosmeticService from '../services/cosmeticService.js';
import { successList, error } from '../utils/responseHelper.js';

/**
 * Listar cosméticos disponibles
 */
const getAvailableCosmetics = async (req, res) => {
  try {
    const { type, acquisitionMethod } = req.query;
    const filters = {};

    if (type) filters.type = type;
    if (acquisitionMethod) filters.acquisitionMethod = acquisitionMethod;

    const cosmetics = await cosmeticService.getAvailableCosmetics(filters);

    return successList(res, cosmetics);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAvailableCosmetics
};

