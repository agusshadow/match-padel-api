import * as matchService from '../services/matchService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todos los matches
const getAllMatches = async (req, res) => {
  try {
    const matches = await matchService.getAllMatches();
    return successList(res, matches);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener un match por ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchById(id);
    return successObject(res, match);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener un match por ID con información detallada
const getMatchByIdDetailed = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchByIdDetailed(id);
    return successObject(res, match);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear un nuevo match
const createMatch = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado
    const userId = req.user.id;
    
    // Establecer team1Player1Id y createdBy desde el usuario autenticado
    // El usuario autenticado es siempre team1Player1 y el creador
    const matchData = {
      ...req.body,
      team1Player1Id: userId, // El usuario autenticado es siempre team1Player1
      createdBy: userId // El usuario autenticado es el creador
    };
    
    // Si el body intenta establecer un team1Player1Id diferente, rechazarlo
    if (req.body.team1Player1Id && req.body.team1Player1Id !== userId) {
      return error(res, 'Solo puedes crear partidos como team1Player1 (anfitrión). No puedes establecer un team1Player1Id diferente', 403, 'FORBIDDEN');
    }
    
    const match = await matchService.createMatch(matchData);
    return successObject(res, match, 201, 'Partido creado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear un nuevo match con reserva de cancha
const createMatchWithReservation = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado
    const userId = req.user.id;
    
    // Combinar los datos del body con el userId
    const matchData = {
      ...req.body,
      userId,
      team1Player1Id: userId, // El usuario autenticado es siempre team1Player1
      createdBy: userId // El usuario autenticado es el creador
    };

    const match = await matchService.createMatchWithReservation(matchData);
    return successObject(res, match, 201, 'Partido creado exitosamente con reserva de cancha');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar un match
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.updateMatch(id, req.body);
    return successObject(res, match, 200, 'Partido actualizado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar un match
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    await matchService.deleteMatch(id);
    return successObject(res, null, 200, 'Partido eliminado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener todos los matches con información detallada
const getAllMatchesDetailed = async (req, res) => {
  try {
    const matches = await matchService.getAllMatchesDetailed();
    return successList(res, matches);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Unirse a un partido
const joinMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { team } = req.body;

    const result = await matchService.joinMatch(matchId, userId, team);
    
    // Convertir el objeto Sequelize a JSON y agregar userPosition
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

// Abandonar un partido
const leaveMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const result = await matchService.leaveMatch(matchId, userId);
    
    // Convertir el objeto Sequelize a JSON y agregar userPosition
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

// Iniciar un partido (scheduled -> in_progress)
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

// Finalizar un partido (in_progress -> pending_confirmation)
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

// Confirmar un partido (pending_confirmation -> completed)
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

// Cancelar un partido (cualquier estado -> cancelled)
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

// Obtener todos los partidos en los que participa el usuario autenticado
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

// Obtener partidos disponibles para unirse
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

// Obtener disponibilidad de equipos de un match
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
