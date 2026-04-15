import MatchScore, { SCORE_STATUS } from '../models/MatchScore.js';
import MatchScoreSet from '../models/MatchScoreSet.js';
import Match from '../models/Match.js';
import { sequelize } from '../config/connection.js';
import { awardMatchExperience } from './experienceService.js';

// Helper para determinar el equipo contrario al creador
const getOpponentTeam = (match) => {
  // El creador siempre es parte del equipo 1, el equipo contrario es el 2
  return 2;
};

// Helper para verificar si un usuario es del equipo contrario al creador
const isUserInOpponentTeam = (match, userId) => {
  if (!match.participants) return false;
  // El equipo 2 es siempre el oponente del creador (que está en el equipo 1)
  return match.participants.some(p => String(p.user_id) === String(userId) && p.team_number === 2);
};

// Helper para verificar si el usuario es el creador (created_by)
const isUserCreator = (match, userId) => {
  return String(match.created_by) === String(userId);
};

// Crear un score para un match
const createMatchScore = async (matchId, userId, scoreData) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match con información completa
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'participants',
          include: [{ association: 'user' }]
        },
        {
          association: 'creator'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario es el creador
    if (!isUserCreator(match, userId)) {
      throw new Error('Solo el creador del partido puede cargar el resultado');
    }

    // Verificar que el match está en estado pending_confirmation
    if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
      throw new Error(`No se puede cargar el resultado. El partido debe estar en estado 'pending_confirmation', actual: ${match.status}`);
    }

    // Verificar que no existe un score ya cargado
    const existingScore = await MatchScore.findOne({
      where: { match_id: matchId },
      transaction
    });

    if (existingScore) {
      throw new Error('Ya existe un resultado cargado para este partido');
    }

    // Validar datos del score
    const { winnerTeam, sets } = scoreData;

    if (!winnerTeam || (winnerTeam !== 1 && winnerTeam !== 2)) {
      throw new Error('El equipo ganador debe ser 1 o 2');
    }

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      throw new Error('Debe proporcionar al menos un set');
    }

    if (sets.length > 5) {
      throw new Error('No se pueden cargar más de 5 sets');
    }

    // Validar que el winnerTeam coincida con los sets
    let team1Wins = 0;
    let team2Wins = 0;

    sets.forEach((set, index) => {
      const setNumber = index + 1;
      const { team1Score, team2Score } = set;

      if (team1Score === undefined || team2Score === undefined) {
        throw new Error(`El set ${setNumber} debe tener team1Score y team2Score`);
      }

      if (team1Score < 0 || team2Score < 0) {
        throw new Error(`Los scores del set ${setNumber} no pueden ser negativos`);
      }

      // Determinar ganador del set
      if (team1Score > team2Score) {
        team1Wins++;
      } else if (team2Score > team1Score) {
        team2Wins++;
      } else {
        throw new Error(`El set ${setNumber} no puede terminar en empate`);
      }
    });

    // Validar que el winnerTeam sea consistente con los sets ganados
    const actualWinner = team1Wins > team2Wins ? 1 : 2;
    if (winnerTeam !== actualWinner) {
      throw new Error(`El equipo ganador (${winnerTeam}) no coincide con los sets ganados (Team 1: ${team1Wins}, Team 2: ${team2Wins})`);
    }

    // Crear el MatchScore
    const matchScore = await MatchScore.create({
      match_id: matchId,
      winner_team: winnerTeam,
      status: SCORE_STATUS.PENDING_CONFIRMATION
    }, { transaction });

    // Crear los MatchScoreSets
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      await MatchScoreSet.create({
        match_score_id: matchScore.id,
        set_number: i + 1,
        team_1_score: set.team1Score,
        team_2_score: set.team2Score
      }, { transaction });
    }

    // Confirmar la transacción
    await transaction.commit();

    // Retornar el score completo con sets
    return await MatchScore.findByPk(matchScore.id, {
      include: [
        {
          association: 'sets',
          order: [['set_number', 'ASC']]
        },
        {
          association: 'match',
          include: [
            {
              association: 'participants',
              include: [{ association: 'user' }]
            }
          ]
        }
      ]
    });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Obtener el score de un match
const getMatchScore = async (matchId) => {
  const matchScore = await MatchScore.findOne({
    where: { match_id: matchId },
    include: [
      {
        association: 'sets',
        order: [['set_number', 'ASC']]
      },
      {
        association: 'confirmer',
        attributes: ['id', 'name', 'email']
      },
      {
        association: 'rejecter',
        attributes: ['id', 'name', 'email']
      },
      {
        association: 'match',
        include: [
          {
            association: 'participants',
            include: [{ association: 'user' }]
          }
        ]
      }
    ]
  });

  return matchScore;
};

// Confirmar un score (por un jugador del equipo contrario)
const confirmMatchScore = async (matchId, userId, comment = null) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'participants'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario es del equipo contrario (team 2)
    if (!isUserInOpponentTeam(match, userId)) {
      throw new Error('Solo un jugador del equipo contrario puede confirmar el resultado');
    }

    // Obtener el score
    const matchScore = await MatchScore.findOne({
      where: { match_id: matchId },
      transaction
    });

    if (!matchScore) {
      throw new Error('No existe un resultado cargado para este partido');
    }

    // Verificar que el score está pendiente de confirmación
    if (matchScore.status !== SCORE_STATUS.PENDING_CONFIRMATION) {
      throw new Error(`El resultado ya fue ${matchScore.status}`);
    }

    // Actualizar el score
    await matchScore.update({
      status: SCORE_STATUS.CONFIRMED,
      confirmed_by: userId,
      confirmation_comment: comment,
      confirmed_at: new Date()
    }, { transaction });

    // Actualizar el estado del match a COMPLETED
    await match.update({
      status: Match.MATCH_STATUS.COMPLETED
    }, { transaction });

    // Otorgar experiencia a los jugadores
    const levelUps = await awardMatchExperience(match, matchScore, transaction);

    // Actualizar progreso de desafíos para todos los jugadores
    const { updateChallengeProgress } = await import('./challengeService.js');
    
    // Obtener todos los jugadores
    const players = match.participants.map(p => p.user_id);

    // Identificar equipo ganador
    const winnerTeam = matchScore.winner_team;
    const winningPlayers = match.participants
      .filter(p => p.team_number === winnerTeam)
      .map(p => p.user_id);

    // Actualizar desafíos para todos los jugadores (jugar partido)
    for (const playerId of players) {
      try {
        await updateChallengeProgress(playerId, 'PLAY_MATCH', { match_id: match.id });
      } catch (error) {
        console.error(`Error actualizando desafío PLAY_MATCH para usuario ${playerId}:`, error);
      }
    }

    // Actualizar desafíos para los ganadores (ganar partido)
    for (const winnerId of winningPlayers) {
      try {
        await updateChallengeProgress(winnerId, 'WIN_MATCH', { match_id: match.id });
      } catch (error) {
        console.error(`Error actualizando desafío WIN_MATCH para usuario ${winnerId}:`, error);
      }
    }

    // Confirmar la transacción
    await transaction.commit();

    // Obtener el score completo
    const scoreData = await getMatchScore(matchId);

    // Agregar información de level ups al resultado si hay
    if (levelUps.length > 0) {
      // Convertir a JSON y agregar levelUps
      const result = scoreData.toJSON();
      result.levelUps = levelUps;
      return result;
    }

    return scoreData;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Rechazar un score (por un jugador del equipo contrario)
const rejectMatchScore = async (matchId, userId, comment) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'participants'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario es del equipo contrario (team 2)
    if (!isUserInOpponentTeam(match, userId)) {
      throw new Error('Solo un jugador del equipo contrario puede rechazar el resultado');
    }

    // Validar que se proporciona un comentario
    if (!comment || comment.trim().length === 0) {
      throw new Error('Debe proporcionar un comentario al rechazar el resultado');
    }

    // Obtener el score
    const matchScore = await MatchScore.findOne({
      where: { match_id: matchId },
      transaction
    });

    if (!matchScore) {
      throw new Error('No existe un resultado cargado para este partido');
    }

    // Verificar que el score está pendiente de confirmación
    if (matchScore.status !== SCORE_STATUS.PENDING_CONFIRMATION) {
      throw new Error(`El resultado ya fue ${matchScore.status}`);
    }

    // Actualizar el score
    await matchScore.update({
      status: SCORE_STATUS.REJECTED,
      rejected_by: userId,
      rejection_comment: comment,
      rejected_at: new Date()
    }, { transaction });

    // Confirmar la transacción
    await transaction.commit();

    // Retornar el score completo
    return await getMatchScore(matchId);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Actualizar un score (solo el creador puede hacerlo si está rechazado)
const updateMatchScore = async (matchId, userId, scoreData) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'participants'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario es el creador
    if (!isUserCreator(match, userId)) {
      throw new Error('Solo el creador del partido puede actualizar el resultado');
    }

    // Obtener el score
    const matchScore = await MatchScore.findOne({
      where: { match_id: matchId },
      include: [{ association: 'sets' }],
      transaction
    });

    if (!matchScore) {
      throw new Error('No existe un resultado cargado para este partido');
    }

    // Solo se puede actualizar si está rechazado
    if (matchScore.status !== SCORE_STATUS.REJECTED) {
      throw new Error('Solo se puede actualizar un resultado que fue rechazado');
    }

    // Validar datos del score (igual que en create)
    const { winnerTeam, sets } = scoreData;

    if (!winnerTeam || (winnerTeam !== 1 && winnerTeam !== 2)) {
      throw new Error('El equipo ganador debe ser 1 o 2');
    }

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      throw new Error('Debe proporcionar al menos un set');
    }

    if (sets.length > 5) {
      throw new Error('No se pueden cargar más de 5 sets');
    }

    // Validar que el winnerTeam coincida con los sets
    let team1Wins = 0;
    let team2Wins = 0;

    sets.forEach((set, index) => {
      const setNumber = index + 1;
      const { team1Score, team2Score } = set;

      if (team1Score === undefined || team2Score === undefined) {
        throw new Error(`El set ${setNumber} debe tener team1Score y team2Score`);
      }

      if (team1Score < 0 || team2Score < 0) {
        throw new Error(`Los scores del set ${setNumber} no pueden ser negativos`);
      }

      if (team1Score > team2Score) {
        team1Wins++;
      } else if (team2Score > team1Score) {
        team2Wins++;
      } else {
        throw new Error(`El set ${setNumber} no puede terminar en empate`);
      }
    });

    const actualWinner = team1Wins > team2Wins ? 1 : 2;
    if (winnerTeam !== actualWinner) {
      throw new Error(`El equipo ganador (${winnerTeam}) no coincide con los sets ganados (Team 1: ${team1Wins}, Team 2: ${team2Wins})`);
    }

    // Actualizar el MatchScore
    await matchScore.update({
      winner_team: winnerTeam,
      status: SCORE_STATUS.PENDING_CONFIRMATION,
      rejected_by: null,
      rejection_comment: null,
      rejected_at: null
    }, { transaction });

    // Eliminar los sets existentes
    await MatchScoreSet.destroy({
      where: { match_score_id: matchScore.id },
      transaction
    });

    // Crear los nuevos sets
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      await MatchScoreSet.create({
        match_score_id: matchScore.id,
        set_number: i + 1,
        team_1_score: set.team1Score,
        team_2_score: set.team2Score
      }, { transaction });
    }

    // Confirmar la transacción
    await transaction.commit();

    // Retornar el score completo
    return await getMatchScore(matchId);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export {
  createMatchScore,
  getMatchScore,
  confirmMatchScore,
  rejectMatchScore,
  updateMatchScore
};

