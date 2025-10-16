import { Op } from 'sequelize';
import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import User from '../models/User.js';
import Court from '../models/Court.js';
import Club from '../models/Club.js';

// Obtener todos los matches
const getAllMatches = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.matchType) {
      whereClause.matchType = filters.matchType;
    }
    
    if (filters.skillLevel) {
      whereClause.skillLevel = filters.skillLevel;
    }
    
    if (filters.playerId) {
      whereClause[Op.or] = [
        { player1Id: filters.playerId },
        { player2Id: filters.playerId },
        { player3Id: filters.playerId },
        { player4Id: filters.playerId }
      ];
    }


    const matches = await Match.findAll({
      where: whereClause,
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            },
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Agregar información sobre jugadores faltantes para partidos disponibles
    const matchesWithAvailability = matches.map(match => {
      const matchData = match.toJSON();
      
      // Calcular jugadores faltantes
      const players = [match.player1Id, match.player2Id, match.player3Id, match.player4Id].filter(Boolean);
      const playersNeeded = 4 - players.length;
      
      // Agregar información de disponibilidad
      matchData.playersNeeded = playersNeeded;
      matchData.isAvailable = playersNeeded > 0 && match.status === 'scheduled';
      matchData.availableSlots = [];
      
      if (!match.player2Id) matchData.availableSlots.push('player2');
      if (!match.player3Id) matchData.availableSlots.push('player3');
      if (!match.player4Id) matchData.availableSlots.push('player4');
      
      return matchData;
    });

    return matchesWithAvailability;
  } catch (error) {
    throw new Error(`Error al obtener matches: ${error.message}`);
  }
};

// Obtener un match por ID
const getMatchById = async (id) => {
  try {
    const match = await Match.findByPk(id, {
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city', 'phone']
                }
              ]
            },
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (!match) {
      throw new Error('Match no encontrado');
    }

    return match;
  } catch (error) {
    throw new Error(`Error al obtener match: ${error.message}`);
  }
};

// Crear un nuevo match
const createMatch = async (matchData) => {
  try {
    // Validar datos requeridos
    const requiredFields = ['reservationId', 'player1Id'];
    for (const field of requiredFields) {
      if (!matchData[field]) {
        throw new Error(`El campo ${field} es requerido`);
      }
    }

    // Verificar que la reserva existe y está confirmada
    const reservation = await CourtReservation.findByPk(matchData.reservationId, {
      include: [
        {
          model: Court,
          as: 'court',
          include: [
            {
              model: Club,
              as: 'club'
            }
          ]
        }
      ]
    });

    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    if (reservation.status !== 'confirmed') {
      throw new Error('Solo se pueden crear matches en reservas confirmadas');
    }

    // Verificar que no existe ya un match para esta reserva
    const existingMatch = await Match.findOne({
      where: { reservationId: matchData.reservationId }
    });

    if (existingMatch) {
      throw new Error('Ya existe un match para esta reserva');
    }

    // Verificar que los jugadores existen
    const players = [matchData.player1Id, matchData.player2Id, matchData.player3Id, matchData.player4Id].filter(Boolean);
    const users = await User.findAll({
      where: { id: players }
    });

    if (users.length !== players.length) {
      throw new Error('Uno o más jugadores no existen');
    }

    const match = await Match.create(matchData);
    
    // Incluir información completa en la respuesta
    const matchWithDetails = await Match.findByPk(match.id, {
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    return matchWithDetails;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al crear match: ${error.message}`);
  }
};

// Actualizar un match
const updateMatch = async (id, updateData) => {
  try {
    const match = await Match.findByPk(id);
    
    if (!match) {
      throw new Error('Match no encontrado');
    }

    // Si se está actualizando el score, validar que el match esté en progreso o completado
    if (updateData.score && !['in_progress', 'completed'].includes(match.status)) {
      throw new Error('Solo se puede actualizar el score de matches en progreso o completados');
    }

    // Si se está marcando como completado, verificar que tenga score
    if (updateData.status === 'completed' && !updateData.score && !match.score) {
      throw new Error('Un match completado debe tener un score');
    }

    await match.update(updateData);
    
    // Incluir información completa en la respuesta
    const updatedMatch = await Match.findByPk(id, {
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    return updatedMatch;
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Datos inválidos: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Error al actualizar match: ${error.message}`);
  }
};

// Eliminar un match
const deleteMatch = async (id) => {
  try {
    const match = await Match.findByPk(id);
    
    if (!match) {
      throw new Error('Match no encontrado');
    }

    // Solo se pueden eliminar matches programados o cancelados
    if (!['scheduled', 'cancelled'].includes(match.status)) {
      throw new Error('Solo se pueden eliminar matches programados o cancelados');
    }

    await match.destroy();
    return { message: 'Match eliminado exitosamente' };
  } catch (error) {
    throw new Error(`Error al eliminar match: ${error.message}`);
  }
};

// Obtener matches por jugador
const getMatchesByPlayer = async (playerId) => {
  try {
    // Verificar que el jugador existe
    const player = await User.findByPk(playerId);
    if (!player) {
      throw new Error('Jugador no encontrado');
    }

    const matches = await Match.findAll({
      where: {
        [Op.or]: [
          { player1Id: playerId },
          { player2Id: playerId },
          { player3Id: playerId },
          { player4Id: playerId }
        ]
      },
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return matches;
  } catch (error) {
    throw new Error(`Error al obtener matches por jugador: ${error.message}`);
  }
};

// Obtener matches por club
const getMatchesByClub = async (clubId) => {
  try {
    // Verificar que el club existe
    const club = await Club.findByPk(clubId);
    if (!club) {
      throw new Error('Club no encontrado');
    }

    const matches = await Match.findAll({
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              where: { clubId: clubId },
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return matches;
  } catch (error) {
    throw new Error(`Error al obtener matches por club: ${error.message}`);
  }
};

// Unirse a un match
const joinMatch = async (matchId, playerId) => {
  try {
    const match = await Match.findByPk(matchId);
    
    if (!match) {
      throw new Error('Match no encontrado');
    }

    // Verificar que el match no esté completado o cancelado
    if (['completed', 'cancelled'].includes(match.status)) {
      throw new Error('No se puede unir a un match completado o cancelado');
    }

    // Verificar que el jugador no esté ya en el match
    const players = [match.player1Id, match.player2Id, match.player3Id, match.player4Id].filter(Boolean);
    if (players.includes(playerId)) {
      throw new Error('El jugador ya está en este match');
    }

    // Verificar que el jugador existe
    const player = await User.findByPk(playerId);
    if (!player) {
      throw new Error('Jugador no encontrado');
    }

    // Encontrar el primer slot disponible
    let updateData = {};
    if (!match.player2Id) {
      updateData.player2Id = playerId;
    } else if (!match.player3Id) {
      updateData.player3Id = playerId;
    } else if (!match.player4Id) {
      updateData.player4Id = playerId;
    } else {
      throw new Error('El match ya está completo (4 jugadores)');
    }

    await match.update(updateData);
    
    // Incluir información completa en la respuesta
    const updatedMatch = await Match.findByPk(matchId, {
      include: [
        {
          model: CourtReservation,
          as: 'reservation',
          include: [
            {
              model: Court,
              as: 'court',
              include: [
                {
                  model: Club,
                  as: 'club',
                  attributes: ['id', 'name', 'address', 'city']
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: 'player1',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'player2',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player3',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'player4',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    return updatedMatch;
  } catch (error) {
    throw new Error(`Error al unirse al match: ${error.message}`);
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
  joinMatch
};
