import MatchScore, { SCORE_STATUS } from '../models/MatchScore.js';
import MatchScoreSet from '../models/MatchScoreSet.js';
import Match from '../models/Match.js';
import { sequelize } from '../config/connection.js';

// Helper para determinar el equipo contrario al creador
const getOpponentTeam = (match) => {
  // El creador siempre es team1Player1, así que el equipo contrario es team 2
  return 2;
};

// Helper para verificar si un usuario es del equipo contrario al creador
const isUserInOpponentTeam = (match, userId) => {
  return match.team2Player1Id === userId || match.team2Player2Id === userId;
};

// Helper para verificar si el usuario es el creador (team1Player1)
const isUserCreator = (match, userId) => {
  return match.team1Player1Id === userId;
};

// Crear un score para un match
const createMatchScore = async (matchId, userId, scoreData) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match con información completa
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario es el creador (team1Player1)
    if (!isUserCreator(match, userId)) {
      throw new Error('Solo el creador del partido puede cargar el resultado');
    }

    // Verificar que el match está en estado pending_confirmation
    if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
      throw new Error(`No se puede cargar el resultado. El partido debe estar en estado 'pending_confirmation', actual: ${match.status}`);
    }

    // Verificar que no existe un score ya cargado
    const existingScore = await MatchScore.findOne({
      where: { matchId },
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
      matchId,
      winnerTeam,
      status: SCORE_STATUS.PENDING_CONFIRMATION
    }, { transaction });

    // Crear los MatchScoreSets
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      await MatchScoreSet.create({
        matchScoreId: matchScore.id,
        setNumber: i + 1,
        team1Score: set.team1Score,
        team2Score: set.team2Score
      }, { transaction });
    }

    // Confirmar la transacción
    await transaction.commit();

    // Retornar el score completo con sets
    return await MatchScore.findByPk(matchScore.id, {
      include: [
        {
          association: 'sets',
          order: [['setNumber', 'ASC']]
        },
        {
          association: 'match',
          include: [
            {
              association: 'team1Player1'
            },
            {
              association: 'team1Player2'
            },
            {
              association: 'team2Player1'
            },
            {
              association: 'team2Player2'
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
    where: { matchId },
    include: [
      {
        association: 'sets',
        order: [['setNumber', 'ASC']]
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
            association: 'team1Player1'
          },
          {
            association: 'team1Player2'
          },
          {
            association: 'team2Player1'
          },
          {
            association: 'team2Player2'
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
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
      where: { matchId },
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
      confirmedBy: userId,
      confirmationComment: comment,
      confirmedAt: new Date()
    }, { transaction });

    // Actualizar el estado del match a COMPLETED
    await match.update({
      status: Match.MATCH_STATUS.COMPLETED
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

// Rechazar un score (por un jugador del equipo contrario)
const rejectMatchScore = async (matchId, userId, comment) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el match
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
      where: { matchId },
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
      rejectedBy: userId,
      rejectionComment: comment,
      rejectedAt: new Date()
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
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
      where: { matchId },
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
      winnerTeam,
      status: SCORE_STATUS.PENDING_CONFIRMATION,
      rejectedBy: null,
      rejectionComment: null,
      rejectedAt: null
    }, { transaction });

    // Eliminar los sets existentes
    await MatchScoreSet.destroy({
      where: { matchScoreId: matchScore.id },
      transaction
    });

    // Crear los nuevos sets
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      await MatchScoreSet.create({
        matchScoreId: matchScore.id,
        setNumber: i + 1,
        team1Score: set.team1Score,
        team2Score: set.team2Score
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

