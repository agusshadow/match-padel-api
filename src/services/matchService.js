import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { sequelize } from '../config/connection.js';

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
      status: Match.MATCH_STATUS.SCHEDULED,
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
const getAllMatchesDetailed = async () => {
  return await Match.findAll({
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

// Abandonar un partido
const leaveMatch = async (matchId, userId) => {
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

    // Verificar que el usuario esté en el partido
    const players = [
      { id: match.player1Id, position: 'player1' },
      { id: match.player2Id, position: 'player2' },
      { id: match.player3Id, position: 'player3' },
      { id: match.player4Id, position: 'player4' }
    ].filter(p => p.id !== null);

    const userPosition = players.find(p => p.id === userId);

    if (!userPosition) {
      throw new Error('No estás participando en este partido');
    }

    // No permitir que el creador (player1) abandone el partido
    if (userPosition.position === 'player1') {
      throw new Error('El creador del partido no puede abandonarlo. Si deseas cancelar el partido, debes eliminarlo');
    }

    // Verificar que el partido no esté en progreso, pendiente de confirmación o completado
    if (
      match.status === Match.MATCH_STATUS.IN_PROGRESS ||
      match.status === Match.MATCH_STATUS.PENDING_CONFIRMATION ||
      match.status === Match.MATCH_STATUS.COMPLETED
    ) {
      throw new Error('No puedes abandonar un partido que ya está en progreso, pendiente de confirmación o completado');
    }

    // Determinar qué posición vaciar
    let updateData = {};
    let position = userPosition.position;

    if (position === 'player2') {
      updateData.player2Id = null;
    } else if (position === 'player3') {
      updateData.player3Id = null;
    } else if (position === 'player4') {
      updateData.player4Id = null;
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
      message: `Has abandonado el partido exitosamente`
    };

  } catch (error) {
    // Revertir la transacción en caso de error
    await transaction.rollback();
    throw error;
  }
};

// Iniciar un partido (scheduled -> in_progress)
const startMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  // Validar que el usuario es uno de los jugadores
  const players = [
    match.player1Id,
    match.player2Id,
    match.player3Id,
    match.player4Id
  ].filter(id => id !== null);

  if (!players.includes(userId)) {
    throw new Error('Solo los jugadores del partido pueden iniciarlo');
  }

  // Validar estado actual
  if (match.status !== Match.MATCH_STATUS.SCHEDULED) {
    throw new Error(`No se puede iniciar un partido con estado: ${match.status}`);
  }

  // Actualizar estado
  await match.update({ status: Match.MATCH_STATUS.IN_PROGRESS });

  // Retornar el partido actualizado con información completa
  return await Match.findByPk(matchId, {
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
};

// Finalizar un partido (in_progress -> pending_confirmation)
const finishMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  // Validar que el usuario es uno de los jugadores
  const players = [
    match.player1Id,
    match.player2Id,
    match.player3Id,
    match.player4Id
  ].filter(id => id !== null);

  if (!players.includes(userId)) {
    throw new Error('Solo los jugadores del partido pueden finalizarlo');
  }

  // Validar estado actual
  if (match.status !== Match.MATCH_STATUS.IN_PROGRESS) {
    throw new Error(`No se puede finalizar un partido con estado: ${match.status}`);
  }

  // Actualizar estado
  await match.update({ status: Match.MATCH_STATUS.PENDING_CONFIRMATION });

  // Retornar el partido actualizado con información completa
  return await Match.findByPk(matchId, {
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
};

// Confirmar un partido (pending_confirmation -> completed)
const confirmMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  // Validar que el usuario es uno de los jugadores
  const players = [
    match.player1Id,
    match.player2Id,
    match.player3Id,
    match.player4Id
  ].filter(id => id !== null);

  if (!players.includes(userId)) {
    throw new Error('Solo los jugadores del partido pueden confirmarlo');
  }

  // Validar estado actual
  if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
    throw new Error(`No se puede confirmar un partido con estado: ${match.status}`);
  }

  // Validar que existe un score
  if (!match.score) {
    throw new Error('No se puede confirmar un partido sin score');
  }

  // Actualizar estado
  await match.update({ status: Match.MATCH_STATUS.COMPLETED });

  // Retornar el partido actualizado con información completa
  return await Match.findByPk(matchId, {
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
};

// Cancelar un partido (cualquier estado -> cancelled)
const cancelMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  // Validar que el usuario es uno de los jugadores (preferiblemente el creador)
  const players = [
    match.player1Id,
    match.player2Id,
    match.player3Id,
    match.player4Id
  ].filter(id => id !== null);

  if (!players.includes(userId)) {
    throw new Error('Solo los jugadores del partido pueden cancelarlo');
  }

  // Validar que no esté ya cancelado o completado
  if (match.status === Match.MATCH_STATUS.CANCELLED) {
    throw new Error('El partido ya está cancelado');
  }

  if (match.status === Match.MATCH_STATUS.COMPLETED) {
    throw new Error('No se puede cancelar un partido completado');
  }

  // Actualizar estado
  await match.update({ status: Match.MATCH_STATUS.CANCELLED });

  // Retornar el partido actualizado con información completa
  return await Match.findByPk(matchId, {
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
  joinMatch,
  leaveMatch,
  startMatch,
  finishMatch,
  confirmMatch,
  cancelMatch
};