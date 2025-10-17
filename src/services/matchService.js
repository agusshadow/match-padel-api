import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';

// Obtener todos los matches
const getAllMatches = async () => {
  return await Match.findAll();
};

// Obtener un match por ID
const getMatchById = async (id) => {
  return await Match.findByPk(id);
};

// Crear un nuevo match
const createMatch = async (matchData) => {
  return await Match.create(matchData);
};

// Actualizar un match
const updateMatch = async (id, updateData) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  return await match.update(updateData);
};

// Eliminar un match
const deleteMatch = async (id) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  return await match.destroy();
};

// Crear un partido con reserva de cancha
const createMatchWithReservation = async (matchData) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Extraer datos de la reserva y del partido
    const {
      slotId,
      userId,
      scheduledDate,
      player1Id,
      player2Id,
      player3Id,
      player4Id,
      notes
    } = matchData;

    // Validar que el usuario que crea el partido sea el mismo que hace la reserva
    if (userId !== player1Id) {
      throw new Error('El usuario que crea el partido debe ser el jugador 1');
    }

    // Obtener información del slot
    const slot = await CourtSlot.findByPk(slotId, {
      include: [
        {
          association: 'court'
        }
      ],
      transaction
    });

    if (!slot) {
      throw new Error('Slot no encontrado');
    }

    // Verificar que el slot esté disponible
    if (!slot.isAvailable) {
      throw new Error('El slot seleccionado no está disponible');
    }

    // Crear la reserva de cancha usando el slotId
    const reservation = await CourtReservation.create({
      courtId: slot.courtId,
      userId,
      scheduledDate,
      slotId: slot.id,
      status: 'confirmed' // La reserva se confirma automáticamente al crear el partido
    }, { transaction });

    // Marcar el slot como no disponible
    await slot.update({ isAvailable: false }, { transaction });

    // Crear el partido
    const match = await Match.create({
      reservationId: reservation.id,
      player1Id,
      player2Id: player2Id || null,
      player3Id: player3Id || null,
      player4Id: player4Id || null,
      status: 'scheduled',
      notes
    }, { transaction });

    // Confirmar la transacción
    await transaction.commit();

    // Retornar el partido con información completa
    return await Match.findByPk(match.id, {
      include: [
        {
          association: 'reservation',
          include: [
            {
              association: 'court',
              include: [
                {
                  association: 'club'
                }
              ]
            },
            {
              association: 'user'
            },
            {
              association: 'slot'
            }
          ]
        },
        {
          association: 'player1'
        },
        {
          association: 'player2'
        },
        {
          association: 'player3'
        },
        {
          association: 'player4'
        }
      ]
    });

  } catch (error) {
    // Revertir la transacción en caso de error
    await transaction.rollback();
    throw error;
  }
};

// Obtener todos los matches con información detallada
const getAllMatchesDetailed = async (filters = {}) => {
  const { status, filterByPlayerId, userId } = filters;
  
  // Construir condiciones WHERE
  const whereConditions = [];
  
  // Filtro por estado de disponibilidad
  if (status === 'available') {
    // Solo partidos que NO tengan los 4 jugadores completos
    whereConditions.push({
      [Op.and]: [
        { player1Id: { [Op.ne]: null } }, // Player1 siempre debe existir
        {
          [Op.or]: [
            { player2Id: null },
            { player3Id: null },
            { player4Id: null }
          ]
        }
      ]
    });
  }
  
  // Filtro por jugador específico
  if (filterByPlayerId && userId) {
    whereConditions.push({
      [Op.or]: [
        { player1Id: userId },
        { player2Id: userId },
        { player3Id: userId },
        { player4Id: userId }
      ]
    });
  }

  // Combinar todas las condiciones con AND
  const finalWhere = whereConditions.length > 0 ? { [Op.and]: whereConditions } : undefined;

  return await Match.findAll({
    where: finalWhere,
    include: [
      {
        association: 'reservation',
        include: [
          {
            association: 'court',
            include: [
              {
                association: 'club'
              }
            ]
          },
          {
            association: 'user'
          },
          {
            association: 'slot'
          }
        ]
      },
      {
        association: 'player1'
      },
      {
        association: 'player2'
      },
      {
        association: 'player3'
      },
      {
        association: 'player4'
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

// Obtener un match por ID con información detallada
const getMatchByIdDetailed = async (id) => {
  const match = await Match.findByPk(id, {
    include: [
      {
        association: 'reservation',
        include: [
          {
            association: 'court',
            include: [
              {
                association: 'club'
              }
            ]
          },
          {
            association: 'user'
          },
          {
            association: 'slot'
          }
        ]
      },
      {
        association: 'player1'
      },
      {
        association: 'player2'
      },
      {
        association: 'player3'
      },
      {
        association: 'player4'
      }
    ]
  });

  if (!match) {
    throw new Error('Match no encontrado');
  }

  return match;
};

// Unirse a un partido
const joinMatch = async (matchId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el partido con información de los jugadores
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'player1'
        },
        {
          association: 'player2'
        },
        {
          association: 'player3'
        },
        {
          association: 'player4'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario no esté ya en el partido
    const existingPlayers = [
      match.player1Id,
      match.player2Id,
      match.player3Id,
      match.player4Id
    ].filter(id => id !== null);

    if (existingPlayers.includes(userId)) {
      throw new Error('Ya estás participando en este partido');
    }

    // Determinar en qué posición agregar al usuario
    let updateData = {};
    let position = '';

    if (match.player2Id === null) {
      updateData.player2Id = userId;
      position = 'player2';
    } else if (match.player3Id === null) {
      updateData.player3Id = userId;
      position = 'player3';
    } else if (match.player4Id === null) {
      updateData.player4Id = userId;
      position = 'player4';
    } else {
      throw new Error('El partido ya está completo (4 jugadores)');
    }

    // Actualizar el partido
    await match.update(updateData, { transaction });

    // Confirmar la transacción
    await transaction.commit();

    // Obtener el partido actualizado con todas las relaciones
    const updatedMatch = await Match.findByPk(matchId, {
      include: [
        {
          association: 'reservation',
          include: [
            {
              association: 'court',
              include: [
                {
                  association: 'club'
                }
              ]
            },
            {
              association: 'user'
            },
            {
              association: 'slot'
            }
          ]
        },
        {
          association: 'player1'
        },
        {
          association: 'player2'
        },
        {
          association: 'player3'
        },
        {
          association: 'player4'
        }
      ]
    });

    return {
      match: updatedMatch,
      position: position,
      message: `Te has unido al partido como ${position}`
    };

  } catch (error) {
    // Revertir la transacción en caso de error
    await transaction.rollback();
    throw error;
  }
};

export {
  getAllMatches,
  getMatchById,
  createMatch,
  createMatchWithReservation,
  updateMatch,
  deleteMatch,
  getAllMatchesDetailed,
  getMatchByIdDetailed,
  joinMatch
};