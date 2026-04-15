import UserLevel from '../models/UserLevel.js';
import UserExperience, { EXPERIENCE_ACTION } from '../models/UserExperience.js';
import Notification, { NOTIFICATION_TYPE } from '../models/Notification.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';

// Valores de XP por acción
const XP_VALUES = {
  PLAY_MATCH: 10,
  WIN_MATCH: 10
};

// Calcular nivel desde experiencia (fórmula exponencial)
const calculateLevel = (experience) => {
  if (experience < 0) return 1;
  // Fórmula: level = floor(sqrt(experience / 10)) + 1
  // Ejemplos: 0 XP = nivel 1, 100 XP = nivel 4, 250 XP = nivel 6
  return Math.floor(Math.sqrt(experience / 10)) + 1;
};

// Obtener o crear UserLevel para un usuario
const getOrCreateUserLevel = async (userId, transaction = null) => {
  let userLevel = await UserLevel.findOne({
    where: { user_id: userId },
    transaction
  });

  if (!userLevel) {
    userLevel = await UserLevel.create({
      user_id: userId,
      experience: 0,
      level: 1
    }, { transaction });
  }

  return userLevel;
};

// Otorgar experiencia a un usuario
const awardExperience = async (userId, action, xpAmount, metadata = null, transaction = null) => {
  // Obtener o crear UserLevel
  const userLevel = await getOrCreateUserLevel(userId, transaction);

  // Calcular nueva experiencia
  const newExperience = userLevel.experience + xpAmount;

  // Guardar log de experiencia
  await UserExperience.create({
    user_id: userId,
    action,
    xp_amount: xpAmount,
    metadata
  }, { transaction });

  // Actualizar experiencia
  await userLevel.update({
    experience: newExperience
  }, { transaction });

  // Verificar si subió de nivel
  const levelUpInfo = await checkLevelUp(userId, newExperience, transaction);

  return {
    experience: newExperience,
    level: levelUpInfo.newLevel,
    levelUp: levelUpInfo.levelUp ? levelUpInfo : null
  };
};

// Verificar y actualizar nivel si subió
const checkLevelUp = async (userId, newExperience, transaction = null) => {
  const userLevel = await getOrCreateUserLevel(userId, transaction);
  const previousLevel = userLevel.level;
  const newLevel = calculateLevel(newExperience);

  if (newLevel > previousLevel) {
    // Actualizar nivel
    await userLevel.update({
      level: newLevel
    }, { transaction });

    // Crear notificación de level up
    await Notification.create({
      user_id: userId,
      type: NOTIFICATION_TYPE.LEVEL_UP,
      data: {
        newLevel,
        previousLevel,
        experience: newExperience,
        experienceToNextLevel: calculateExperienceForNextLevel(newLevel, newExperience)
      },
      read: false
    }, { transaction });

    return {
      levelUp: true,
      previousLevel,
      newLevel,
      experience: newExperience,
      experienceToNextLevel: calculateExperienceForNextLevel(newLevel, newExperience)
    };
  }

  return {
    levelUp: false,
    previousLevel,
    newLevel: previousLevel,
    experience: newExperience,
    experienceToNextLevel: calculateExperienceForNextLevel(previousLevel, newExperience)
  };
};

// Calcular experiencia necesaria para el siguiente nivel
// Fórmula inversa: level = floor(sqrt(experience / 10)) + 1
// Para nivel N+1: necesitamos experience >= 10 * N^2
const calculateExperienceForNextLevel = (currentLevel, currentExperience) => {
  // Experiencia mínima necesaria para el siguiente nivel
  const nextLevelMinExperience = 10 * Math.pow(currentLevel, 2);
  // Experiencia restante necesaria
  const experienceNeeded = nextLevelMinExperience - currentExperience;
  return Math.max(0, experienceNeeded);
};

// Otorgar experiencia por partido completado
const awardMatchExperience = async (match, matchScore, transaction = null) => {
  const levelUps = [];

  // Obtener todos los jugadores del partido desde match.participants
  const participants = match.participants || [];
  const players = participants.map(p => p.user_id);

  // Identificar equipo ganador
  const winnerTeam = matchScore.winner_team;
  const winningPlayers = participants
    .filter(p => p.team_number === winnerTeam)
    .map(p => p.user_id);

  // Metadata para el log (solo match_id)
  const metadata = {
    match_id: match.id
  };

  // Otorgar XP a todos los jugadores por jugar
  for (const playerId of players) {
    // Verificar si ya se otorgó XP por este partido (prevenir duplicados)
    // Buscar todas las experiencias del usuario con PLAY_MATCH y verificar metadata
    const existingExperiences = await UserExperience.findAll({
      where: {
        user_id: playerId,
        action: EXPERIENCE_ACTION.PLAY_MATCH
      },
      transaction
    });

    // Verificar si alguna tiene el mismo match_id en metadata
    const existingExperience = existingExperiences.find(exp => {
      return exp.metadata && (exp.metadata.match_id === match.id || exp.metadata.matchId === match.id);
    });

    if (existingExperience) {
      // Ya se otorgó XP por este partido, saltar
      continue;
    }

    // Otorgar XP por jugar
    const playResult = await awardExperience(
      playerId,
      EXPERIENCE_ACTION.PLAY_MATCH,
      XP_VALUES.PLAY_MATCH,
      metadata,
      transaction
    );

    // Si subió de nivel, guardar info
    if (playResult.levelUp) {
      levelUps.push({
        user_id: playerId,
        ...playResult.levelUp
      });
    }

    // Si es ganador, otorgar XP extra
    if (winningPlayers.includes(playerId)) {
      const winResult = await awardExperience(
        playerId,
        EXPERIENCE_ACTION.WIN_MATCH,
        XP_VALUES.WIN_MATCH,
        metadata,
        transaction
      );

      // Si subió de nivel por ganar, actualizar info
      if (winResult.levelUp) {
        const existingLevelUp = levelUps.find(lu => lu.user_id === playerId);
        if (existingLevelUp) {
          Object.assign(existingLevelUp, winResult.levelUp);
        } else {
          levelUps.push({
            user_id: playerId,
            ...winResult.levelUp
          });
        }
      }
    }
  }

  return levelUps;
};

// Obtener experiencia y nivel del usuario
const getUserExperience = async (userId) => {
  const userLevel = await getOrCreateUserLevel(userId);

  const nextLevelExperience = calculateExperienceForNextLevel(
    userLevel.level,
    userLevel.experience
  );

  return {
    experience: userLevel.experience,
    level: userLevel.level,
    experienceToNextLevel: nextLevelExperience
  };
};

// Obtener historial de experiencia del usuario
const getExperienceHistory = async (userId, limit = 50) => {
  const history = await UserExperience.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    limit
  });

  return history;
};

export {
  awardExperience,
  awardMatchExperience,
  calculateLevel,
  checkLevelUp,
  getUserExperience,
  getExperienceHistory,
  XP_VALUES
};

