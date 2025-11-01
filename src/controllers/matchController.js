import * as matchService from '../services/matchService.js';

// Obtener todos los matches
const getAllMatches = async (req, res) => {
  try {
    const matches = await matchService.getAllMatches();
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un match por ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchById(id);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener un match por ID con información detallada
const getMatchByIdDetailed = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchByIdDetailed(id);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear un nuevo match
const createMatch = async (req, res) => {
  try {
    const match = await matchService.createMatch(req.body);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      player1Id: userId // El usuario autenticado es siempre el jugador 1
    };

    const match = await matchService.createMatchWithReservation(matchData);
    res.status(201).json({ 
      success: true, 
      data: match,
      message: 'Partido creado exitosamente con reserva de cancha'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar un match
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.updateMatch(id, req.body);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar un match
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    await matchService.deleteMatch(id);
    res.json({ success: true, message: 'Match eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener todos los matches con información detallada
const getAllMatchesDetailed = async (req, res) => {
  try {
    const { status, filterByPlayerId } = req.query;
    const userId = req.user?.id; // Obtener userId del token si está autenticado
    
    const filters = {
      status,
      filterByPlayerId: filterByPlayerId === 'true',
      userId
    };
    
    const matches = await matchService.getAllMatchesDetailed(filters);
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unirse a un partido
const joinMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params; // Obtener el ID del match de la URL
    const userId = req.user.id; // Obtener el ID del usuario autenticado

    const result = await matchService.joinMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: result.match,
      position: result.position,
      message: result.message 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Abandonar un partido
const leaveMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params; // Obtener el ID del match de la URL
    const userId = req.user.id; // Obtener el ID del usuario autenticado

    const result = await matchService.leaveMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: result.match,
      position: result.position,
      message: result.message 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  leaveMatch
};
