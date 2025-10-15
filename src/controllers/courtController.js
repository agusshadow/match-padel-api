const courtService = require('../services/courtService');

// Obtener todas las canchas
const getAllCourts = async (req, res) => {
  try {
    const filters = {
      clubId: req.query.clubId,
      type: req.query.type,
      surface: req.query.surface,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    const courts = await courtService.getAllCourts(filters);

    res.json({
      success: true,
      message: 'Canchas obtenidas exitosamente',
      data: courts,
      count: courts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener una cancha por ID
const getCourtById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const court = await courtService.getCourtById(parseInt(id));

    res.json({
      success: true,
      message: 'Cancha obtenida exitosamente',
      data: court
    });
  } catch (error) {
    const statusCode = error.message === 'Cancha no encontrada' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Crear una nueva cancha
const createCourt = async (req, res) => {
  try {
    const courtData = req.body;

    const court = await courtService.createCourt(courtData);

    res.status(201).json({
      success: true,
      message: 'Cancha creada exitosamente',
      data: court
    });
  } catch (error) {
    const statusCode = error.message.includes('requerido') || 
                      error.message.includes('inválidos') || 
                      error.message.includes('no encontrado') || 
                      error.message.includes('inactivo') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar una cancha
const updateCourt = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const court = await courtService.updateCourt(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Cancha actualizada exitosamente',
      data: court
    });
  } catch (error) {
    const statusCode = error.message === 'Cancha no encontrada' ? 404 : 
                      error.message.includes('inválidos') || 
                      error.message.includes('no encontrado') || 
                      error.message.includes('inactivo') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar una cancha
const deleteCourt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const result = await courtService.deleteCourt(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Cancha no encontrada' ? 404 : 
                      error.message.includes('reservas activas') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener canchas por club
const getCourtsByClub = async (req, res) => {
  try {
    const { clubId } = req.params;

    if (!clubId || isNaN(clubId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de club inválido'
      });
    }

    const courts = await courtService.getCourtsByClub(parseInt(clubId));

    res.json({
      success: true,
      message: 'Canchas del club obtenidas exitosamente',
      data: courts,
      count: courts.length
    });
  } catch (error) {
    const statusCode = error.message === 'Club no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener canchas por tipo
const getCourtsByType = async (req, res) => {
  try {
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de cancha es requerido'
      });
    }

    const courts = await courtService.getCourtsByType(type);

    res.json({
      success: true,
      message: `Canchas tipo ${type} obtenidas exitosamente`,
      data: courts,
      count: courts.length
    });
  } catch (error) {
    const statusCode = error.message.includes('inválido') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
  getCourtsByClub,
  getCourtsByType
};
