import * as cosmeticService from '../services/cosmeticService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

/**
 * Listar todos los cosméticos disponibles
 */
const getAvailableCosmetics = async (req, res) => {
  try {
    const cosmetics = await cosmeticService.getAvailableCosmetics();
    return successList(res, cosmetics);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

/**
 * Equipar un cosmético
 */
const equipCosmetic = async (req, res) => {
  try {
    const userId = req.user.id;
    const cosmeticId = parseInt(req.params.id);

    if (isNaN(cosmeticId)) {
      return error(res, 'ID de cosmético inválido', 400, 'VALIDATION_ERROR');
    }

    const userCosmetic = await cosmeticService.equipCosmetic(userId, cosmeticId);

    return successObject(res, userCosmetic, 200, 'Cosmético equipado exitosamente');
  } catch (err) {
    if (err.message === 'Cosmético no encontrado') {
      return error(res, err.message, 404, 'NOT_FOUND');
    }
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAvailableCosmetics,
  equipCosmetic
};

