import Challenge, { CHALLENGE_TYPE } from '../models/Challenge.js';
import UserChallenge, { USER_CHALLENGE_STATUS } from '../models/UserChallenge.js';
import { Op } from 'sequelize';

/**
 * Asignar desafíos de un tipo específico a un usuario
 */
const assignChallengesToUser = async (userId, challengeType) => {
  // Obtener desafíos activos del tipo especificado
  const challenges = await Challenge.findAll({
    where: {
      type: challengeType,
      is_active: true
    }
  });

  if (challenges.length === 0) {
    return [];
  }

  // Calcular fecha de expiración según el tipo
  const now = new Date();
  let expiresAt;
  
  switch (challengeType) {
    case CHALLENGE_TYPE.DAILY:
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 1);
      expiresAt.setHours(0, 0, 0, 0);
      break;
    case CHALLENGE_TYPE.WEEKLY:
      expiresAt = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      expiresAt.setDate(expiresAt.getDate() + daysUntilMonday);
      expiresAt.setHours(0, 0, 0, 0);
      break;
    case CHALLENGE_TYPE.MONTHLY:
      expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      expiresAt.setHours(0, 0, 0, 0);
      break;
    default:
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 1);
  }

  const assignedChallenges = [];

  for (const challenge of challenges) {
    // Verificar si el usuario ya tiene este desafío activo
    const existingChallenge = await UserChallenge.findOne({
      where: {
        user_id: userId,
        challenge_id: challenge.id,
        status: {
          [Op.in]: [USER_CHALLENGE_STATUS.PENDING, USER_CHALLENGE_STATUS.COMPLETED]
        },
        expires_at: {
          [Op.gt]: now
        }
      }
    });

    if (!existingChallenge) {
      const userChallenge = await UserChallenge.create({
        user_id: userId,
        challenge_id: challenge.id,
        assigned_at: now,
        expires_at: expiresAt,
        progress: 0,
        status: USER_CHALLENGE_STATUS.PENDING
      });
      assignedChallenges.push(userChallenge);
    }
  }

  return assignedChallenges;
};

/**
 * Asignar desafíos diarios a un usuario
 */
const assignDailyChallenges = async (userId) => {
  return await assignChallengesToUser(userId, CHALLENGE_TYPE.DAILY);
};

/**
 * Asignar desafíos semanales a un usuario
 */
const assignWeeklyChallenges = async (userId) => {
  return await assignChallengesToUser(userId, CHALLENGE_TYPE.WEEKLY);
};

/**
 * Asignar desafíos mensuales a un usuario
 */
const assignMonthlyChallenges = async (userId) => {
  return await assignChallengesToUser(userId, CHALLENGE_TYPE.MONTHLY);
};

/**
 * Actualizar progreso de desafíos basado en una acción
 * Event-driven: se llama cuando ocurre una acción relevante
 */
const updateChallengeProgress = async (userId, actionType, metadata = {}) => {
  const now = new Date();

  // Buscar desafíos activos del usuario que coincidan con la acción
  const userChallenges = await UserChallenge.findAll({
    where: {
      user_id: userId,
      status: USER_CHALLENGE_STATUS.PENDING,
      expires_at: {
        [Op.gt]: now
      }
    },
    include: [{
      model: Challenge,
      as: 'challenge',
      where: {
        action_type: actionType,
        is_active: true
      }
    }]
  });

  const completedChallenges = [];

  for (const userChallenge of userChallenges) {
    const challenge = userChallenge.challenge;
    
    // Incrementar progreso
    const newProgress = userChallenge.progress + 1;
    
    await userChallenge.update({
      progress: newProgress
    });

    // Verificar si se completó
    if (newProgress >= challenge.target_value) {
      await userChallenge.update({
        status: USER_CHALLENGE_STATUS.COMPLETED,
        completed_at: now
      });
      completedChallenges.push(userChallenge);
    }
  }

  return completedChallenges;
};

/**
 * Obtener desafíos del usuario con filtros opcionales
 * Por defecto, solo retorna desafíos activos (no expirados)
 */
const getUserChallenges = async (userId, filters = {}) => {
  const now = new Date();
  const where = {
    user_id: userId
  };

  // Si se especifica un estado, usarlo; si no, excluir expirados por defecto
  if (filters.status) {
    where.status = filters.status;
  } else {
    // Por defecto, excluir desafíos expirados
    where.status = {
      [Op.ne]: USER_CHALLENGE_STATUS.EXPIRED
    };
    // También excluir desafíos que ya expiraron por fecha (aunque no estén marcados como expired)
    where.expires_at = {
      [Op.gte]: now
    };
  }

  // Construir el where del include para el Challenge
  const challengeWhere = {};
  if (filters.type) {
    challengeWhere.type = filters.type;
  }

  const userChallenges = await UserChallenge.findAll({
    where,
    include: [{
      model: Challenge,
      as: 'challenge',
      where: Object.keys(challengeWhere).length > 0 ? challengeWhere : undefined
    }],
    order: [['assigned_at', 'DESC']]
  });

  return userChallenges;
};

/**
 * Validar si un usuario puede reclamar un desafío
 */
const canClaimChallenge = async (userId, userChallengeId) => {
  const userChallenge = await UserChallenge.findOne({
    where: {
      id: userChallengeId,
      user_id: userId
    },
    include: [{
      model: Challenge,
      as: 'challenge'
    }]
  });

  if (!userChallenge) {
    return { canClaim: false, reason: 'Desafío no encontrado' };
  }

  if (userChallenge.status !== USER_CHALLENGE_STATUS.COMPLETED) {
    return { canClaim: false, reason: 'El desafío no está completado' };
  }

  const now = new Date();
  if (userChallenge.expires_at < now) {
    return { canClaim: false, reason: 'El desafío ha expirado' };
  }

  if (userChallenge.status === USER_CHALLENGE_STATUS.CLAIMED) {
    return { canClaim: false, reason: 'El desafío ya fue reclamado' };
  }

  return { canClaim: true, userChallenge };
};

/**
 * Reclamar recompensa de un desafío completado
 */
const claimChallengeReward = async (userId, userChallengeId) => {
  const validation = await canClaimChallenge(userId, userChallengeId);
  
  if (!validation.canClaim) {
    throw new Error(validation.reason);
  }

  const { userChallenge } = validation;
  const challenge = userChallenge.challenge;
  const now = new Date();

  // Actualizar estado a reclamado
  await userChallenge.update({
    status: USER_CHALLENGE_STATUS.CLAIMED,
    claimed_at: now
  });

  const rewards = {
    xp: null,
    cosmetic: null
  };

  // Otorgar recompensas según el tipo
  if (challenge.reward_type === 'xp' || challenge.reward_type === 'both') {
    rewards.xp = challenge.reward_xp;
  }

  if (challenge.reward_type === 'cosmetic' || challenge.reward_type === 'both') {
    rewards.cosmetic = challenge.reward_cosmetic_id;
  }

  return {
    userChallenge,
    challenge,
    rewards
  };
};

/**
 * Limpiar desafíos expirados
 */
const cleanupExpiredChallenges = async () => {
  const now = new Date();
  
  const updated = await UserChallenge.update(
    {
      status: USER_CHALLENGE_STATUS.EXPIRED
    },
    {
      where: {
        status: {
          [Op.in]: [USER_CHALLENGE_STATUS.PENDING, USER_CHALLENGE_STATUS.COMPLETED]
        },
        expires_at: {
          [Op.lt]: now
        }
      }
    }
  );

  return updated[0]; // Número de filas actualizadas
};

export {
  assignDailyChallenges,
  assignWeeklyChallenges,
  assignMonthlyChallenges,
  assignChallengesToUser,
  updateChallengeProgress,
  getUserChallenges,
  canClaimChallenge,
  claimChallengeReward,
  cleanupExpiredChallenges
};

