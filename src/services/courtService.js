import Court from '../models/Court.js';
import Club from '../models/Club.js';

// Obtener todas las canchas
const getAllCourts = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.clubId) {
      whereClause.clubId = filters.clubId;
    }
    
    if (filters.type) {
      whereClause.type = filters.type;
    }
    
    if (filters.surface) {
      whereClause.surface = filters.surface;
    }
    
    if (filters.isActive !== undefined) {
      whereClause.isActive = filters.isActive;
    }

    const courts = await Court.findAll({
      where: whereClause,
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city']
        }
      ],
      order: [['name', 'ASC']]
    });

    return courts;
  } catch (error) {
    throw new Error(`Error al obtener canchas: ${error.message}`);
  }
};

// Obtener una cancha por ID
const getCourtById = async (id) => {
  try {
    const court = await Court.findByPk(id, {
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city', 'phone']
        }
      ]
    });

    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    return court;
  } catch (error) {
    throw new Error(`Error al obtener cancha: ${error.message}`);
  }
};

// Crear una nueva cancha
const createCourt = async (courtData) => {
  try {
    // Validar datos requeridos
    const requiredFields = ['clubId', 'name', 'type', 'surface'];
    for (const field of requiredFields) {
      if (!courtData[field]) {
        throw new Error(`El campo ${field} es requerido`);
      }
    }

    // Verificar que el club existe
    const club = await Club.findByPk(courtData.clubId);
    if (!club) {
      throw new Error('Club no encontrado');
    }

    // Verificar que el club esté activo
    if (!club.isActive) {
      throw new Error('No se puede crear una cancha en un club inactivo');
    }

    const court = await Court.create(courtData);
    
    // Incluir información del club en la respuesta
    const courtWithClub = await Court.findByPk(court.id, {
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city']
        }
      ]
    });

    return courtWithClub;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al crear cancha: ${error.message}`);
  }
};

// Actualizar una cancha
const updateCourt = async (id, updateData) => {
  try {
    const court = await Court.findByPk(id);
    
    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Si se está actualizando el clubId, verificar que el nuevo club existe y está activo
    if (updateData.clubId && updateData.clubId !== court.clubId) {
      const club = await Club.findByPk(updateData.clubId);
      if (!club) {
        throw new Error('Club no encontrado');
      }
      if (!club.isActive) {
        throw new Error('No se puede mover una cancha a un club inactivo');
      }
    }

    await court.update(updateData);
    
    // Incluir información del club en la respuesta
    const updatedCourt = await Court.findByPk(id, {
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city']
        }
      ]
    });

    return updatedCourt;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al actualizar cancha: ${error.message}`);
  }
};

// Eliminar una cancha (soft delete)
const deleteCourt = async (id) => {
  try {
    const court = await Court.findByPk(id);
    
    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // TODO: Verificar si tiene reservas activas cuando se implemente
    // const activeReservations = await CourtReservation.count({
    //   where: { courtId: id, status: ['pending', 'confirmed'] }
    // });

    // if (activeReservations > 0) {
    //   throw new Error('No se puede eliminar una cancha con reservas activas');
    // }

    await court.update({ isActive: false });
    return { message: 'Cancha desactivada exitosamente' };
  } catch (error) {
    throw new Error(`Error al eliminar cancha: ${error.message}`);
  }
};

// Obtener canchas por club
const getCourtsByClub = async (clubId) => {
  try {
    // Verificar que el club existe
    const club = await Club.findByPk(clubId);
    if (!club) {
      throw new Error('Club no encontrado');
    }

    const courts = await Court.findAll({
      where: { 
        clubId: clubId,
        isActive: true 
      },
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city']
        }
      ],
      order: [['name', 'ASC']]
    });

    return courts;
  } catch (error) {
    throw new Error(`Error al obtener canchas por club: ${error.message}`);
  }
};

// Obtener canchas por tipo
const getCourtsByType = async (type) => {
  try {
    const validTypes = ['indoor', 'outdoor', 'covered'];
    if (!validTypes.includes(type)) {
      throw new Error('Tipo de cancha inválido. Tipos válidos: indoor, outdoor, covered');
    }

    const courts = await Court.findAll({
      where: { 
        type: type,
        isActive: true 
      },
      include: [
        {
          model: Club,
          as: 'club',
          attributes: ['id', 'name', 'address', 'city']
        }
      ],
      order: [['name', 'ASC']]
    });

    return courts;
  } catch (error) {
    throw new Error(`Error al obtener canchas por tipo: ${error.message}`);
  }
};

export {
  getAllCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
  getCourtsByClub,
  getCourtsByType
};
