import * as matchService from '../services/matchService.js';

// Obtener todos los matches
const getAllMatches = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      matchType: req.query.matchType,
      skillLevel: req.query.skillLevel,
      playerId: req.query.playerId
    };

    const matches = await matchService.getAllMatches(filters);

    res.json({
      success: true,
      message: 'Matches obtenidos exitosamente',
      data: matches,
      count: matches.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener un match por ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    const match = await matchService.getMatchById(parseInt(id));

    res.json({
      success: true,
      message: 'Match obtenido exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Crear un nuevo match
const createMatch = async (req, res) => {
  try {
    const matchData = req.body;

    const match = await matchService.createMatch(matchData);

    res.status(201).json({
      success: true,
      message: 'Match creado exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message.includes('requerido') || 
                      error.message.includes('inválidos') || 
                      error.message.includes('no encontrada') || 
                      error.message.includes('confirmadas') ||
                      error.message.includes('existe') ||
                      error.message.includes('no existen') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar un match
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    const match = await matchService.updateMatch(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Match actualizado exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 
                      error.message.includes('inválidos') || 
                      error.message.includes('progreso') ||
                      error.message.includes('completado') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar un match
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    const result = await matchService.deleteMatch(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 
                      error.message.includes('programados') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener matches por jugador
const getMatchesByPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;

    if (!playerId || isNaN(playerId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de jugador inválido'
      });
    }

    const matches = await matchService.getMatchesByPlayer(parseInt(playerId));

    res.json({
      success: true,
      message: 'Matches del jugador obtenidos exitosamente',
      data: matches,
      count: matches.length
    });
  } catch (error) {
    const statusCode = error.message === 'Jugador no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener matches por club
const getMatchesByClub = async (req, res) => {
  try {
    const { clubId } = req.params;

    if (!clubId || isNaN(clubId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de club inválido'
      });
    }

    const matches = await matchService.getMatchesByClub(parseInt(clubId));

    res.json({
      success: true,
      message: 'Matches del club obtenidos exitosamente',
      data: matches,
      count: matches.length
    });
  } catch (error) {
    const statusCode = error.message === 'Club no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar score de un match
const updateMatchScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    if (!score) {
      return res.status(400).json({
        success: false,
        message: 'Score es requerido'
      });
    }

    const updateData = { 
      score: score,
      status: 'completed' // Automáticamente marcar como completado al actualizar score
    };

    const match = await matchService.updateMatch(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Score actualizado exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 
                      error.message.includes('inválidos') || 
                      error.message.includes('progreso') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Iniciar un match
const startMatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    const updateData = { status: 'in_progress' };
    const match = await matchService.updateMatch(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Match iniciado exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Cancelar un match
const cancelMatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    const updateData = { status: 'cancelled' };
    const match = await matchService.updateMatch(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Match cancelado exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Unirse a un match
const joinMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de match inválido'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'ID de jugador es requerido'
      });
    }

    const match = await matchService.joinMatch(parseInt(id), parseInt(playerId));

    res.json({
      success: true,
      message: 'Jugador agregado al match exitosamente',
      data: match
    });
  } catch (error) {
    const statusCode = error.message === 'Match no encontrado' ? 404 : 
                      error.message.includes('completado') || 
                      error.message.includes('cancelado') ||
                      error.message.includes('ya está') ||
                      error.message.includes('completo') ||
                      error.message.includes('no encontrado') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch,
  getMatchesByPlayer,
  getMatchesByClub,
  updateMatchScore,
  startMatch,
  cancelMatch,
  joinMatch
};
