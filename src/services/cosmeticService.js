import Cosmetic from '../models/Cosmetic.js';
import UserCosmetic from '../models/UserCosmetic.js';
import UserProfile from '../models/UserProfile.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';
import { ACQUIRED_METHOD } from '../models/UserCosmetic.js';

/**
 * Obtener todos los cosméticos disponibles
 */
const getAvailableCosmetics = async () => {
  const cosmetics = await Cosmetic.findAll({
    where: {
      isActive: true
    },
    order: [['createdAt', 'ASC']]
  });

  return cosmetics;
};

/**
 * Equipar un cosmético (si no lo tiene, lo asocia automáticamente)
 */
const equipCosmetic = async (userId, cosmeticId) => {
  const transaction = await sequelize.transaction();

  try {
    // Verificar que el cosmético existe y está activo
    const cosmetic = await Cosmetic.findByPk(cosmeticId, { transaction });
    if (!cosmetic) {
      throw new Error('Cosmético no encontrado');
    }
    if (!cosmetic.isActive) {
      throw new Error('Cosmético no está disponible');
    }

    // Buscar o crear el UserCosmetic
    let userCosmetic = await UserCosmetic.findOne({
      where: { userId, cosmeticId },
      include: [
        {
          model: Cosmetic,
          as: 'cosmetic',
          required: true
        }
      ],
      transaction
    });

    // Si no lo tiene, crearlo (asociarlo al usuario)
    if (!userCosmetic) {
      userCosmetic = await UserCosmetic.create({
        userId,
        cosmeticId,
        acquiredMethod: ACQUIRED_METHOD.FREE, // Por defecto free para v1
        isEquipped: false
      }, { 
        transaction,
        include: [
          {
            model: Cosmetic,
            as: 'cosmetic'
          }
        ]
      });
      
      // Recargar con la relación incluida
      userCosmetic = await UserCosmetic.findOne({
        where: { userId, cosmeticId },
        include: [
          {
            model: Cosmetic,
            as: 'cosmetic',
            required: true
          }
        ],
        transaction
      });
    }

    const cosmeticType = userCosmetic.cosmetic.type;

    // Buscar otros cosméticos del mismo tipo que estén equipados
    const otherEquippedCosmetics = await UserCosmetic.findAll({
      where: {
        userId,
        isEquipped: true,
        cosmeticId: { [Op.ne]: cosmeticId }
      },
      include: [
        {
          model: Cosmetic,
          as: 'cosmetic',
          where: { type: cosmeticType },
          required: true
        }
      ],
      transaction
    });

    // Desequipar otros cosméticos del mismo tipo
    if (otherEquippedCosmetics.length > 0) {
      const otherCosmeticIds = otherEquippedCosmetics.map(uc => uc.cosmeticId);
      await UserCosmetic.update(
        { isEquipped: false },
        {
          where: {
            userId,
            cosmeticId: { [Op.in]: otherCosmeticIds },
            isEquipped: true
          },
          transaction
        }
      );
    }

    // Si el cosmético es una paleta, actualizar UserProfile
    if (cosmeticType === 'palette') {
      await UserProfile.update(
        { equippedPaletteId: cosmeticId },
        {
          where: { userId },
          transaction
        }
      );
    }

    // Equipar el cosmético seleccionado
    await userCosmetic.update({ isEquipped: true }, { transaction });

    await transaction.commit();

    return userCosmetic;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export {
  getAvailableCosmetics,
  equipCosmetic
};

