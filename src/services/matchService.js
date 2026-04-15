import Match from '../models/Match.js';
import MatchParticipant from '../models/MatchParticipant.js';
import User from '../models/User.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';

const getAllMatchPlayers = async (matchId) => {
  const participants = await MatchParticipant.findAll({
    where: { match_id: matchId }
  });
  return participants.map(p => p.user_id);
};

const isUserInMatch = async (matchId, userId) => {
  const participant = await MatchParticipant.findOne({
    where: { match_id: matchId, user_id: userId }
  });
  return !!participant;
};

const getTeamAvailability = async (matchId) => {
  const participants = await MatchParticipant.findAll({
    where: { match_id: matchId },
    include: [{ model: User, as: 'user', include: ['profile'] }]
  });

  const team1 = participants.filter(p => p.team_number === 1);
  const team2 = participants.filter(p => p.team_number === 2);

  return {
    team1: {
      available: team1.length < 2,
      hasSpace: team1.length < 2,
      players: team1.map(p => p.user)
    },
    team2: {
      available: team2.length < 2,
      hasSpace: team2.length < 2,
      players: team2.map(p => p.user)
    }
  };
};

const getAllMatches = async () => {
  return await Match.findAll();
};

const getMatchById = async (id) => {
  return await Match.findByPk(id);
};

const createMatch = async (matchData) => {
  if (!matchData.created_by) {
    throw new Error('El campo created_by es requerido');
  }
  
  const transaction = await sequelize.transaction();
  try {
    const match = await Match.create(matchData, { transaction });
    
    await MatchParticipant.create({
      match_id: match.id,
      user_id: matchData.created_by,
      team_number: 1,
      position: 'left' // Default position for creator
    }, { transaction });

    await transaction.commit();
    return match;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateMatch = async (id, updateData) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  
  if (updateData.hasOwnProperty('created_by')) {
    delete updateData.created_by;
  }
  
  return await match.update(updateData);
};

const deleteMatch = async (id) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  return await match.destroy();
};

const createMatchWithReservation = async (matchData) => {
  const { combineDateAndTime, validateMatchCreation } = await import('../utils/matchValidations.js');
  const transaction = await sequelize.transaction();
  
  try {
    const {
      slotId: slot_id,
      userId: user_id,
      scheduledDate: scheduled_date,
      notes
    } = matchData;

    if (!slot_id || !scheduled_date) {
      throw new Error('slotId y scheduledDate son requeridos');
    }

    const slot = await CourtSlot.findByPk(slot_id, {
      include: [{ association: 'court' }],
      transaction
    });

    if (!slot) {
      throw new Error('Slot no encontrado');
    }

    const validation = await validateMatchCreation(scheduled_date, slot, slot_id);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const scheduled_date_time = combineDateAndTime(scheduled_date, slot.start_time);
    const end_date_time = combineDateAndTime(scheduled_date, slot.end_time);

    const reservation = await CourtReservation.create({
      court_id: slot.court_id,
      user_id,
      scheduled_date,
      slot_id: slot.id,
      scheduled_date_time,
      end_date_time,
      price: slot.price,
      status: 'confirmed'
    }, { transaction });

    const match = await Match.create({
      reservation_id: reservation.id,
      created_by: user_id,
      match_date_time: scheduled_date_time,
      match_end_date_time: end_date_time,
      status: Match.MATCH_STATUS.SCHEDULED,
      notes
    }, { transaction });

    await MatchParticipant.create({
      match_id: match.id,
      user_id: user_id,
      team_number: 1,
      position: 'left'
    }, { transaction });

    await transaction.commit();

    return await getMatchByIdDetailed(match.id);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getAllMatchesDetailed = async () => {
  return await Match.findAll({
    include: [
      {
        association: 'reservation',
        include: [
          { association: 'court', include: [{ association: 'club' }] },
          { association: 'user' }
        ]
      },
      {
        association: 'participants',
        include: [{ model: User, as: 'user', include: ['profile'] }]
      }
    ],
    order: [['match_date_time', 'ASC']]
  });
};

const getMatchByIdDetailed = async (id) => {
  const match = await Match.findByPk(id, {
    include: [
      {
        association: 'reservation',
        include: [
          { association: 'court', include: [{ association: 'club' }] },
          { association: 'user' }
        ]
      },
      {
        association: 'participants',
        include: [{ model: User, as: 'user', include: ['profile'] }]
      }
    ]
  });

  if (!match) {
    throw new Error('Match no encontrado');
  }

  return match;
};

const getMatchTeamAvailability = async (matchId) => {
  const match = await getMatchByIdDetailed(matchId);
  const teamAvailability = await getTeamAvailability(matchId);
  const playersCount = await MatchParticipant.count({ where: { match_id: matchId } });

  return {
    match,
    teams: teamAvailability,
    isFull: playersCount >= 4
  };
};

const joinMatch = async (matchId, userId, desiredTeam = null) => {
  const transaction = await sequelize.transaction();

  try {
    const match = await Match.findByPk(matchId, { transaction });
    if (!match) throw new Error('Partido no encontrado');

    if (await isUserInMatch(matchId, userId)) {
      throw new Error('Ya estás participando en este partido');
    }

    const participants = await MatchParticipant.findAll({ where: { match_id: matchId }, transaction });
    if (participants.length >= 4) {
      throw new Error('El partido ya está completo (4 jugadores)');
    }

    let team_number = desiredTeam;
    const team1Count = participants.filter(p => p.team_number === 1).length;
    const team2Count = participants.filter(p => p.team_number === 2).length;

    if (team_number !== null) {
      if (team_number !== 1 && team_number !== 2) throw new Error('El equipo debe ser 1 o 2');
      if (team_number === 1 && team1Count >= 2) throw new Error('El equipo 1 ya está completo');
      if (team_number === 2 && team2Count >= 2) throw new Error('El equipo 2 ya está completo');
    } else {
      team_number = team1Count < 2 ? 1 : 2;
    }

    const participant = await MatchParticipant.create({
      match_id: matchId,
      user_id: userId,
      team_number,
      position: (team_number === 1 ? (team1Count === 0 ? 'left' : 'right') : (team2Count === 0 ? 'left' : 'right'))
    }, { transaction });

    await transaction.commit();

    const updatedMatch = await getMatchByIdDetailed(matchId);

    return {
      match: updatedMatch,
      position: participant.position,
      team: team_number,
      message: `Te has unido al equipo ${team_number} como ${participant.position}`
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const leaveMatch = async (matchId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const match = await Match.findByPk(matchId, { transaction });
    if (!match) throw new Error('Partido no encontrado');

    const participant = await MatchParticipant.findOne({
      where: { match_id: matchId, user_id: userId },
      transaction
    });

    if (!participant) {
      throw new Error('No estás participando en este partido');
    }

    if (match.created_by === userId) {
      throw new Error('El creador del partido no puede abandonarlo. Si deseas cancelar el partido, debes eliminarlo');
    }

    if ([Match.MATCH_STATUS.IN_PROGRESS, Match.MATCH_STATUS.PENDING_CONFIRMATION, Match.MATCH_STATUS.COMPLETED].includes(match.status)) {
      throw new Error('No puedes abandonar un partido que ya está en progreso, pendiente de confirmación o completado');
    }

    await participant.destroy({ transaction });
    await transaction.commit();

    const updatedMatch = await getMatchByIdDetailed(matchId);

    return {
      match: updatedMatch,
      message: `Has abandonado el partido exitosamente`
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const startMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  if (!match) throw new Error('Partido no encontrado');

  if (!(await isUserInMatch(matchId, userId))) {
    throw new Error('Solo los jugadores del partido pueden iniciarlo');
  }

  if (match.status !== Match.MATCH_STATUS.SCHEDULED) {
    throw new Error(`No se puede iniciar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.IN_PROGRESS, started_at: new Date() });
  return await getMatchByIdDetailed(matchId);
};

const finishMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  if (!match) throw new Error('Partido no encontrado');

  if (!(await isUserInMatch(matchId, userId))) {
    throw new Error('Solo los jugadores del partido pueden finalizarlo');
  }

  if (match.status !== Match.MATCH_STATUS.IN_PROGRESS) {
    throw new Error(`No se puede finalizar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.PENDING_CONFIRMATION, finished_at: new Date() });
  return await getMatchByIdDetailed(matchId);
};

const confirmMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId, { include: ['score'] });
  if (!match) throw new Error('Partido no encontrado');

  if (!match.score || match.score.status !== 'confirmed') {
    throw new Error('No se puede confirmar un partido sin un resultado confirmado.');
  }

  if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
    throw new Error(`No se puede confirmar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.COMPLETED });
  return await getMatchByIdDetailed(matchId);
};

const cancelMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  if (!match) throw new Error('Partido no encontrado');

  if (!(await isUserInMatch(matchId, userId))) {
    throw new Error('Solo los jugadores del partido pueden cancelarlo');
  }

  if (match.status === Match.MATCH_STATUS.CANCELLED) throw new Error('El partido ya está cancelado');
  if (match.status === Match.MATCH_STATUS.COMPLETED) throw new Error('No se puede cancelar un partido completado');

  await match.update({ status: Match.MATCH_STATUS.CANCELLED, cancelled_at: new Date(), cancelled_by: userId });
  return await getMatchByIdDetailed(matchId);
};

const getUserMatches = async (userId, filters = {}) => {
  const { status, upcoming, past } = filters;
  const now = new Date();
  
  const matchIds = (await MatchParticipant.findAll({
    where: { user_id: userId },
    attributes: ['match_id']
  })).map(p => p.match_id);

  const whereConditions = { id: { [Op.in]: matchIds } };

  if (status) {
    if (!Match.MATCH_STATUS_VALUES.includes(status)) throw new Error('Status inválido');
    whereConditions.status = status;
  }

  if (upcoming) {
    whereConditions.match_date_time = { [Op.gte]: now };
  } else if (past) {
    whereConditions.match_date_time = { [Op.lt]: now };
  }

  return await Match.findAll({
    where: whereConditions,
    include: [
      {
        association: 'reservation',
        include: [
          { association: 'court', include: [{ association: 'club' }] },
          { association: 'user' }
        ]
      },
      {
        association: 'participants',
        include: [{ model: User, as: 'user', include: ['profile'] }]
      }
    ],
    order: [['match_date_time', 'ASC']]
  });
};

const getAvailableMatches = async (userId = null, filters = {}) => {
  const { dateFilter, availableSpaces } = filters;
  const now = new Date();
  
  const whereConditions = {
    status: Match.MATCH_STATUS.SCHEDULED,
    match_date_time: { [Op.gte]: now }
  };

  if (dateFilter) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today); endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7); endOfWeek.setHours(23, 59, 59, 999);

    if (dateFilter === 'today') whereConditions.match_date_time = { [Op.between]: [now, endOfToday] };
    else if (dateFilter === 'thisWeek') whereConditions.match_date_time = { [Op.between]: [now, endOfWeek] };
  }

  const matches = await Match.findAll({
    where: whereConditions,
    include: [
      {
        association: 'reservation',
        required: true,
        include: [
          { association: 'court', include: [{ association: 'club' }] },
          { association: 'user' }
        ]
      },
      {
        association: 'participants',
        include: [{ model: User, as: 'user', include: ['profile'] }]
      }
    ],
    order: [['match_date_time', 'ASC']]
  });

  let filteredMatches = matches;
  
  // Filtrar partidos donde el usuario ya participa
  if (userId) {
    filteredMatches = filteredMatches.filter(m => !m.participants.some(p => p.user_id === userId));
  }

  // Filtrar por espacios disponibles
  filteredMatches = filteredMatches.filter(m => m.participants.length < 4);

  if (availableSpaces) {
    filteredMatches = filteredMatches.filter(m => {
      const spots = 4 - m.participants.length;
      return availableSpaces === 'one' ? spots === 1 : spots >= 2;
    });
  }

  return filteredMatches;
};

export {
  getAllMatches,
  getMatchById,
  createMatch,
  createMatchWithReservation,
  updateMatch,
  deleteMatch,
  getAllMatchesDetailed,
  getMatchByIdDetailed,
  getMatchTeamAvailability,
  joinMatch,
  leaveMatch,
  startMatch,
  finishMatch,
  confirmMatch,
  cancelMatch,
  getUserMatches,
  getAvailableMatches
};