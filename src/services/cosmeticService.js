import Cosmetic from '../models/Cosmetic.js';
import UserProfile from '../models/UserProfile.js';
import { sequelize } from '../config/connection.js';

const getAvailableCosmetics = async () => {
  const cosmetics = await Cosmetic.findAll({
    where: {
      isActive: true
    },
    order: [['createdAt', 'ASC']]
  });

  return cosmetics;
};

const equipCosmetic = async (userId, cosmeticId) => {
  const transaction = await sequelize.transaction();

  try {
    const cosmetic = await Cosmetic.findByPk(cosmeticId, { transaction });
    if (!cosmetic) {
      throw new Error('Cosmético no encontrado');
    }
    if (!cosmetic.isActive) {
      throw new Error('Cosmético no está disponible');
    }

    if (cosmetic.type !== 'palette') {
      throw new Error('Solo se pueden equipar paletas por el momento');
    }

    await UserProfile.update(
      { equippedPaletteId: cosmeticId },
      {
        where: { userId },
        transaction
      }
    );

    const userProfile = await UserProfile.findOne({
      where: { userId },
      include: [
        {
          model: Cosmetic,
          as: 'equippedPalette',
          required: false
        }
      ],
      transaction
    });

    await transaction.commit();

    return {
      userId,
      cosmeticId,
      cosmetic,
      equippedPalette: userProfile?.equippedPalette || null
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export {
  getAvailableCosmetics,
  equipCosmetic
};

