import Cosmetic from '../models/Cosmetic.js';

/**
 * Obtener cosméticos disponibles con filtros opcionales
 */
const getAvailableCosmetics = async (filters = {}) => {
  const where = {
    isActive: true
  };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.acquisitionMethod) {
    where.acquisitionMethod = filters.acquisitionMethod;
  }

  const cosmetics = await Cosmetic.findAll({
    where,
    order: [['createdAt', 'ASC']]
  });

  return cosmetics;
};

export {
  getAvailableCosmetics
};

