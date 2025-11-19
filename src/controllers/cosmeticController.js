import * as cosmeticService from '../services/cosmeticService.js';

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

    res.json({
      success: true,
      data: {
        cosmetics
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAvailableCosmetics
};

