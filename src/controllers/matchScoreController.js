import * as matchScoreService from '../services/matchScoreService.js';
import { successObject, error } from '../utils/responseHelper.js';

// Crear un score para un match (solo el creador)
const createMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { winnerTeam, sets } = req.body;

    if (!winnerTeam || !sets) {
      return error(res, 'Debe proporcionar winnerTeam y sets', 400, 'VALIDATION_ERROR');
    }

    const matchScore = await matchScoreService.createMatchScore(matchId, userId, { winnerTeam, sets });

    return successObject(res, matchScore, 201, 'Resultado cargado exitosamente, pendiente de confirmación');
  } catch (err) {
    const statusCode = err.message.includes('no encontrado') ||
                      err.message.includes('puede cargar') ||
                      err.message.includes('estado') ||
                      err.message.includes('Ya existe') ||
                      err.message.includes('Debe proporcionar') ||
                      err.message.includes('coincide') ||
                      err.message.includes('empate') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

// Obtener el score de un match
const getMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const matchScore = await matchScoreService.getMatchScore(matchId);

    if (!matchScore) {
      return error(res, 'No existe un resultado cargado para este partido', 404, 'NOT_FOUND');
    }

    return successObject(res, matchScore);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Confirmar un score (solo un jugador del equipo contrario)
const confirmMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    const matchScore = await matchScoreService.confirmMatchScore(matchId, userId, comment);

    return successObject(res, matchScore, 200, 'Resultado confirmado exitosamente. El partido ha sido completado.');
  } catch (err) {
    const statusCode = err.message.includes('no encontrado') ||
                      err.message.includes('puede confirmar') ||
                      err.message.includes('No existe') ||
                      err.message.includes('ya fue') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

// Rechazar un score (solo un jugador del equipo contrario)
const rejectMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return error(res, 'Debe proporcionar un comentario al rechazar el resultado', 400, 'VALIDATION_ERROR');
    }

    const matchScore = await matchScoreService.rejectMatchScore(matchId, userId, comment);

    return successObject(res, matchScore, 200, 'Resultado rechazado. El creador puede actualizar el resultado.');
  } catch (err) {
    const statusCode = err.message.includes('no encontrado') ||
                      err.message.includes('puede rechazar') ||
                      err.message.includes('Debe proporcionar') ||
                      err.message.includes('No existe') ||
                      err.message.includes('ya fue') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

// Actualizar un score (solo el creador si fue rechazado)
const updateMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { winnerTeam, sets } = req.body;

    if (!winnerTeam || !sets) {
      return error(res, 'Debe proporcionar winnerTeam y sets', 400, 'VALIDATION_ERROR');
    }

    const matchScore = await matchScoreService.updateMatchScore(matchId, userId, { winnerTeam, sets });

    return successObject(res, matchScore, 200, 'Resultado actualizado exitosamente, pendiente de confirmación');
  } catch (err) {
    const statusCode = err.message.includes('no encontrado') ||
                      err.message.includes('puede actualizar') ||
                      err.message.includes('Solo se puede actualizar') ||
                      err.message.includes('No existe') ||
                      err.message.includes('Debe proporcionar') ||
                      err.message.includes('coincide') ||
                      err.message.includes('empate') ? 400 : 500;
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    return error(res, err.message, statusCode, errorCode);
  }
};

export {
  createMatchScore,
  getMatchScore,
  confirmMatchScore,
  rejectMatchScore,
  updateMatchScore
};

