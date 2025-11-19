import * as challengeService from '../services/challengeService.js';
import Challenge from '../models/Challenge.js';

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

    // Si no es admin, solo mostrar activos
    if (req.user.role !== 'admin') {
      where.isActive = true;
    } else if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const challenges = await Challenge.findAll({
      where,
      order: [['type', 'ASC'], ['createdAt', 'ASC']]
    });

    res.json({ success: true, data: challenges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener mis desafíos activos
 * Query params opcionales:
 * - type: 'daily' | 'weekly' | 'monthly' - Filtrar por tipo de desafío
 * - status: 'pending' | 'completed' | 'claimed' | 'expired' - Filtrar por estado
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
        return res.status(400).json({
          success: false,
          message: `Tipo inválido. Valores permitidos: ${validTypes.join(', ')}`
        });
      }
      filters.type = type.toLowerCase();
    }
    
    // Validar y agregar filtro por estado
    if (status) {
      const validStatuses = ['pending', 'completed', 'claimed', 'expired'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`
        });
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

    res.json({
      success: true,
      data: {
        challenges: userChallenges,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({
        success: false,
        message: 'Desafío no encontrado'
      });
    }

    res.json({ success: true, data: userChallenge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Si hay cosmético, otorgarlo
    let cosmeticResult = null;
    if (result.rewards.cosmetic) {
      const { grantChallengeCosmetic } = await import('../services/cosmeticService.js');
      cosmeticResult = await grantChallengeCosmetic(
        userId,
        result.rewards.cosmetic,
        result.challenge.id
      );
    }

    res.json({
      success: true,
      data: {
        challenge: result.challenge,
        userChallenge: result.userChallenge,
        rewards: {
          xp: result.rewards.xp,
          cosmetic: result.rewards.cosmetic
        },
        xpResult,
        cosmeticResult
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export {
  getAllChallenges,
  getMyChallenges,
  getMyChallengeById,
  claimChallengeReward
};

