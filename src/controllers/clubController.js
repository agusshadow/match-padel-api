const clubService = require('../services/clubService');

// Obtener todos los clubs
const getAllClubs = async (req, res) => {
  try {
    const filters = {
      city: req.query.city,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    const clubs = await clubService.getAllClubs(filters);

    res.json({
      success: true,
      message: 'Clubs obtenidos exitosamente',
      data: clubs,
      count: clubs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener un club por ID
const getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de club inválido'
      });
    }

    const club = await clubService.getClubById(parseInt(id));

    res.json({
      success: true,
      message: 'Club obtenido exitosamente',
      data: club
    });
  } catch (error) {
    const statusCode = error.message === 'Club no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Crear un nuevo club
const createClub = async (req, res) => {
  try {
    const clubData = req.body;

    const club = await clubService.createClub(clubData);

    res.status(201).json({
      success: true,
      message: 'Club creado exitosamente',
      data: club
    });
  } catch (error) {
    const statusCode = error.message.includes('requerido') || error.message.includes('inválidos') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar un club
const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de club inválido'
      });
    }

    const club = await clubService.updateClub(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Club actualizado exitosamente',
      data: club
    });
  } catch (error) {
    const statusCode = error.message === 'Club no encontrado' ? 404 : 
                      error.message.includes('inválidos') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar un club
const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de club inválido'
      });
    }

    const result = await clubService.deleteClub(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Club no encontrado' ? 404 : 
                      error.message.includes('canchas activas') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener clubs por ciudad
const getClubsByCity = async (req, res) => {
  try {
    const { city } = req.params;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'Ciudad es requerida'
      });
    }

    const clubs = await clubService.getClubsByCity(city);

    res.json({
      success: true,
      message: `Clubs en ${city} obtenidos exitosamente`,
      data: clubs,
      count: clubs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllClubs,
  getClubById,
  createClub,
  updateClub,
  deleteClub,
  getClubsByCity
};
