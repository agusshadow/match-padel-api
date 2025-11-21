import * as matchService from '../services/matchService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

const getAllMatches = async (req, res) => {
  try {
    const matches = await matchService.getAllMatches();
    return successList(res, matches);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchById(id);
    return successObject(res, match);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const getMatchByIdDetailed = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchByIdDetailed(id);
    return successObject(res, match);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const createMatch = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const matchData = {
      ...req.body,
      team1Player1Id: userId,
      createdBy: userId
    };
    
    if (req.body.team1Player1Id && req.body.team1Player1Id !== userId) {
      return error(res, 'Solo puedes crear partidos como team1Player1 (anfitrión). No puedes establecer un team1Player1Id diferente', 403, 'FORBIDDEN');
    }
    
    const match = await matchService.createMatch(matchData);
    return successObject(res, match, 201, 'Partido creado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const createMatchWithReservation = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const matchData = {
      ...req.body,
      userId,
      team1Player1Id: userId,
      createdBy: userId
    };

    const match = await matchService.createMatchWithReservation(matchData);
    return successObject(res, match, 201, 'Partido creado exitosamente con reserva de cancha');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.updateMatch(id, req.body);
    return successObject(res, match, 200, 'Partido actualizado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    await matchService.deleteMatch(id);
    return successObject(res, null, 200, 'Partido eliminado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const getAllMatchesDetailed = async (req, res) => {
  try {
    const matches = await matchService.getAllMatchesDetailed();
    return successList(res, matches);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const joinMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { team } = req.body;

    const result = await matchService.joinMatch(matchId, userId, team);
    
    const matchData = result.match.toJSON ? result.match.toJSON() : result.match;
    const matchWithPosition = {
      ...matchData,
      userPosition: result.position
    };
    
    return successObject(res, matchWithPosition, 200, result.message);
  } catch (err) {
    const statusCode = err.message.includes('debe ser') || 
                      err.message.includes('completo') ||
                      err.message.includes('participando') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

const leaveMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const result = await matchService.leaveMatch(matchId, userId);
    
    const matchData = result.match.toJSON ? result.match.toJSON() : result.match;
    const matchWithPosition = {
      ...matchData,
      userPosition: result.position
    };
    
    return successObject(res, matchWithPosition, 200, result.message);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const startMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.startMatch(matchId, userId);
    return successObject(res, match, 200, 'Partido iniciado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const finishMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.finishMatch(matchId, userId);
    return successObject(res, match, 200, 'Partido finalizado, pendiente de confirmación');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const confirmMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.confirmMatch(matchId, userId);
    return successObject(res, match, 200, 'Partido confirmado y completado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const cancelMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.cancelMatch(matchId, userId);
    return successObject(res, match, 200, 'Partido cancelado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const getUserMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      status: req.query.status || null,
      upcoming: req.query.upcoming === 'true',
      past: req.query.past === 'true'
    };
    const matches = await matchService.getUserMatches(userId, filters);
    return successList(res, matches);
  } catch (err) {
    const statusCode = err.message.includes('Status inválido') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

const getAvailableMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateFilter, availableSpaces } = req.query;
    const matches = await matchService.getAvailableMatches(userId, { dateFilter, availableSpaces });
    return successList(res, matches);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

const getMatchTeamAvailability = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const result = await matchService.getMatchTeamAvailability(matchId);
    return successObject(res, result);
  } catch (err) {
    const statusCode = err.message.includes('no encontrado') ? 404 : 500;
    const errorCode = statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

export {
  getAllMatches,
  getMatchById,
  getMatchByIdDetailed,
  createMatch,
  createMatchWithReservation,
  updateMatch,
  deleteMatch,
  getAllMatchesDetailed,
  joinMatch,
  leaveMatch,
  startMatch,
  finishMatch,
  confirmMatch,
  cancelMatch,
  getUserMatches,
  getAvailableMatches,
  getMatchTeamAvailability
};
