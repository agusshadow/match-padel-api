import * as matchScoreService from '../services/matchScoreService.js';

// Crear un score para un match (solo el creador)
const createMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { winnerTeam, sets } = req.body;

    if (!winnerTeam || !sets) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar winnerTeam y sets'
      });
    }

    const matchScore = await matchScoreService.createMatchScore(matchId, userId, { winnerTeam, sets });

    res.status(201).json({
      success: true,
      data: matchScore,
      message: 'Resultado cargado exitosamente, pendiente de confirmación'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ||
                      error.message.includes('puede cargar') ||
                      error.message.includes('estado') ||
                      error.message.includes('Ya existe') ||
                      error.message.includes('Debe proporcionar') ||
                      error.message.includes('coincide') ||
                      error.message.includes('empate') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Obtener el score de un match
const getMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const matchScore = await matchScoreService.getMatchScore(matchId);

    if (!matchScore) {
      return res.status(404).json({
        success: false,
        message: 'No existe un resultado cargado para este partido'
      });
    }

    res.json({
      success: true,
      data: matchScore
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Confirmar un score (solo un jugador del equipo contrario)
const confirmMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    const matchScore = await matchScoreService.confirmMatchScore(matchId, userId, comment);

    res.json({
      success: true,
      data: matchScore,
      message: 'Resultado confirmado exitosamente. El partido ha sido completado.'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ||
                      error.message.includes('puede confirmar') ||
                      error.message.includes('No existe') ||
                      error.message.includes('ya fue') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Rechazar un score (solo un jugador del equipo contrario)
const rejectMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un comentario al rechazar el resultado'
      });
    }

    const matchScore = await matchScoreService.rejectMatchScore(matchId, userId, comment);

    res.json({
      success: true,
      data: matchScore,
      message: 'Resultado rechazado. El creador puede actualizar el resultado.'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ||
                      error.message.includes('puede rechazar') ||
                      error.message.includes('Debe proporcionar') ||
                      error.message.includes('No existe') ||
                      error.message.includes('ya fue') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Actualizar un score (solo el creador si fue rechazado)
const updateMatchScore = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;
    const { winnerTeam, sets } = req.body;

    if (!winnerTeam || !sets) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar winnerTeam y sets'
      });
    }

    const matchScore = await matchScoreService.updateMatchScore(matchId, userId, { winnerTeam, sets });

    res.json({
      success: true,
      data: matchScore,
      message: 'Resultado actualizado exitosamente, pendiente de confirmación'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ||
                      error.message.includes('puede actualizar') ||
                      error.message.includes('Solo se puede actualizar') ||
                      error.message.includes('No existe') ||
                      error.message.includes('Debe proporcionar') ||
                      error.message.includes('coincide') ||
                      error.message.includes('empate') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export {
  createMatchScore,
  getMatchScore,
  confirmMatchScore,
  rejectMatchScore,
  updateMatchScore
};

