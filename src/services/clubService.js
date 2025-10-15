const Club = require('../models/Club');
const Court = require('../models/Court');

// Obtener todos los clubs
const getAllClubs = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.city) {
      whereClause.city = filters.city;
    }
    
    if (filters.isActive !== undefined) {
      whereClause.isActive = filters.isActive;
    }

    const clubs = await Club.findAll({
      where: whereClause,
      include: [
        {
          model: Court,
          as: 'courts',
          where: { isActive: true },
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    return clubs;
  } catch (error) {
    throw new Error(`Error al obtener clubs: ${error.message}`);
  }
};

// Obtener un club por ID
const getClubById = async (id) => {
  try {
    const club = await Club.findByPk(id, {
      include: [
        {
          model: Court,
          as: 'courts',
          where: { isActive: true },
          required: false
        }
      ]
    });

    if (!club) {
      throw new Error('Club no encontrado');
    }

    return club;
  } catch (error) {
    throw new Error(`Error al obtener club: ${error.message}`);
  }
};

// Crear un nuevo club
const createClub = async (clubData) => {
  try {
    // Validar datos requeridos
    const requiredFields = ['name', 'address', 'city'];
    for (const field of requiredFields) {
      if (!clubData[field]) {
        throw new Error(`El campo ${field} es requerido`);
      }
    }

    const club = await Club.create(clubData);
    return club;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al crear club: ${error.message}`);
  }
};

// Actualizar un club
const updateClub = async (id, updateData) => {
  try {
    const club = await Club.findByPk(id);
    
    if (!club) {
      throw new Error('Club no encontrado');
    }

    await club.update(updateData);
    return club;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al actualizar club: ${error.message}`);
  }
};

// Eliminar un club (soft delete)
const deleteClub = async (id) => {
  try {
    const club = await Club.findByPk(id);
    
    if (!club) {
      throw new Error('Club no encontrado');
    }

    // Verificar si tiene canchas activas
    const activeCourts = await Court.count({
      where: { clubId: id, isActive: true }
    });

    if (activeCourts > 0) {
      throw new Error('No se puede eliminar un club que tiene canchas activas');
    }

    await club.update({ isActive: false });
    return { message: 'Club desactivado exitosamente' };
  } catch (error) {
    throw new Error(`Error al eliminar club: ${error.message}`);
  }
};

// Obtener clubs por ciudad
const getClubsByCity = async (city) => {
  try {
    const clubs = await Club.findAll({
      where: { 
        city: city,
        isActive: true 
      },
      include: [
        {
          model: Court,
          as: 'courts',
          where: { isActive: true },
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    return clubs;
  } catch (error) {
    throw new Error(`Error al obtener clubs por ciudad: ${error.message}`);
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
