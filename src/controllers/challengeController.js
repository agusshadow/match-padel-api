import * as challengeService from '../services/challengeService.js';
import Challenge from '../models/Challenge.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

/**
 * Obtener todos los desafíos disponibles (admin) o activos (usuario)
 */
const getAllChallenges = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const where = {};

    if (type) {
      where.type = type;
    }

    // Si no es admin (o no está autenticado), solo mostrar activos
    if (!req.user || req.user.role !== 'admin') {
      where.is_active = true;
    } else if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    const challenges = await Challenge.findAll({
      where,
      order: [['type', 'ASC'], ['created_at', 'ASC']]
    });

    return successList(res, challenges);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

/**
 * Obtener mis desafíos activos (por defecto excluye expirados)
 * Query params opcionales:
 * - type: 'daily' | 'weekly' | 'monthly' - Filtrar por tipo de desafío
 * - status: 'pending' | 'completed' | 'claimed' | 'expired' - Filtrar por estado (si no se especifica, excluye expirados)
 */
const getMyChallenges = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status } = req.query;

    const filters = {};
    
    // Validar y agregar filtro por tipo
    if (type) {
      const validTypes = ['daily', 'weekly', 'monthly'];
      if (!validTypes.includes(type.toLowerCase())) {
        return error(res, `Tipo inválido. Valores permitidos: ${validTypes.join(', ')}`, 400, 'VALIDATION_ERROR');
      }
      filters.type = type.toLowerCase();
    }
    
    // Validar y agregar filtro por estado
    if (status) {
      const validStatuses = ['pending', 'completed', 'claimed', 'expired'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return error(res, `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`, 400, 'VALIDATION_ERROR');
      }
      filters.status = status.toLowerCase();
    }

    const userChallenges = await challengeService.getUserChallenges(userId, filters);

    // Calcular estadísticas
    const stats = {
      pending: 0,
      completed: 0,
      claimed: 0,
      expired: 0
    };

    userChallenges.forEach(uc => {
      if (stats[uc.status] !== undefined) {
        stats[uc.status]++;
      }
    });

    return successObject(res, {
      challenges: userChallenges,
      stats
    });
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

/**
 * Obtener detalle de un desafío específico mío
 */
const getMyChallengeById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const userChallenges = await challengeService.getUserChallenges(userId);
    const userChallenge = userChallenges.find(uc => uc.id === parseInt(id));

    if (!userChallenge) {
      return error(res, 'Desafío no encontrado', 404, 'NOT_FOUND');
    }

    return successObject(res, userChallenge);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

/**
 * Reclamar recompensa de un desafío completado
 */
const claimChallengeReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // userChallengeId

    const result = await challengeService.claimChallengeReward(userId, parseInt(id));

    // Si hay XP, otorgarlo
    let xpResult = null;
    if (result.rewards.xp) {
      const { awardExperience } = await import('../services/experienceService.js');
      xpResult = await awardExperience(
        userId,
        'CHALLENGE_REWARD',
        result.rewards.xp,
        { challengeId: result.challenge.id, userChallengeId: id }
      );
    }

    // Nota: La lógica de otorgar cosméticos por desafíos está deshabilitada en v1
    // Si hay cosmético, solo se retorna el ID pero no se otorga automáticamente
    let cosmeticResult = null;
    if (result.rewards.cosmetic) {
      cosmeticResult = {
        cosmeticId: result.rewards.cosmetic,
        message: 'El cosmético debe ser equipado manualmente desde el endpoint de cosméticos'
      };
    }

    return successObject(res, {
      challenge: result.challenge,
      userChallenge: result.userChallenge,
      rewards: {
        xp: result.rewards.xp,
        cosmetic: result.rewards.cosmetic
      },
      xpResult,
      cosmeticResult
    }, 200, 'Recompensa reclamada exitosamente');
  } catch (err) {
    return error(res, err.message, 400, 'VALIDATION_ERROR');
  }
};

export {
  getAllChallenges,
  getMyChallenges,
  getMyChallengeById,
  claimChallengeReward
};

