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
      return res.status(403).json({ 
        success: false, 
        message: 'Solo puedes crear partidos como team1Player1 (anfitrión). No puedes establecer un team1Player1Id diferente' 
      });
    }
    
    const match = await matchService.createMatch(matchData);
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
      team1Player1Id: userId, // El usuario autenticado es siempre team1Player1
      createdBy: userId // El usuario autenticado es el creador
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
    const matches = await matchService.getAllMatchesDetailed();
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
    const { team } = req.body; // Equipo deseado (opcional): 1 o 2

    const result = await matchService.joinMatch(matchId, userId, team);
    
    res.json({ 
      success: true, 
      data: result.match,
      position: result.position,
      message: result.message 
    });
  } catch (error) {
    const statusCode = error.message.includes('debe ser') || 
                      error.message.includes('completo') ||
                      error.message.includes('participando') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
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

// Iniciar un partido (scheduled -> in_progress)
const startMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.startMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: match,
      message: 'Partido iniciado exitosamente' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Finalizar un partido (in_progress -> pending_confirmation)
const finishMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.finishMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: match,
      message: 'Partido finalizado, pendiente de confirmación' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Confirmar un partido (pending_confirmation -> completed)
const confirmMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.confirmMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: match,
      message: 'Partido confirmado y completado' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancelar un partido (cualquier estado -> cancelled)
const cancelMatch = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const userId = req.user.id;

    const match = await matchService.cancelMatch(matchId, userId);
    
    res.json({ 
      success: true, 
      data: match,
      message: 'Partido cancelado exitosamente' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener todos los partidos en los que participa el usuario autenticado
const getUserMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || null; // Obtener status de query params
    const matches = await matchService.getUserMatches(userId, status);
    res.json({ success: true, data: matches });
  } catch (error) {
    // Si es error de validación, devolver 400, sino 500
    const statusCode = error.message.includes('Status inválido') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Obtener partidos disponibles para unirse
const getAvailableMatches = async (req, res) => {
  try {
    // El usuario está autenticado (la ruta está protegida)
    // Usar su ID para excluir partidos donde ya está participando
    const userId = req.user.id;
    const { dateFilter, availableSpaces } = req.query;
    const matches = await matchService.getAvailableMatches(userId, { dateFilter, availableSpaces });
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener disponibilidad de equipos de un match
const getMatchTeamAvailability = async (req, res) => {
  try {
    const { id: matchId } = req.params;
    const result = await matchService.getMatchTeamAvailability(matchId);
    res.json({ 
      success: true, 
      data: result,
      message: `Equipo 1 disponible: ${result.teams.team1.hasSpace}, Equipo 2 disponible: ${result.teams.team2.hasSpace}` 
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
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
