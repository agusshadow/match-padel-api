import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';

// Helper para obtener todos los jugadores de un match
const getAllMatchPlayers = (match) => {
  return [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].filter(id => id !== null);
};

// Helper para verificar si un usuario está en el match
const isUserInMatch = (match, userId) => {
  return getAllMatchPlayers(match).includes(userId);
};

// Helper para obtener información de disponibilidad por equipo
const getTeamAvailability = (match) => {
  return {
    team1: {
      available: !match.team1Player2Id,
      hasSpace: !match.team1Player2Id,
      players: [
        match.team1Player1,
        match.team1Player2
      ].filter(Boolean)
    },
    team2: {
      available: !match.team2Player1Id || !match.team2Player2Id,
      hasSpace: !match.team2Player1Id || !match.team2Player2Id,
      players: [
        match.team2Player1,
        match.team2Player2
      ].filter(Boolean)
    }
  };
};

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
  // Validar que createdBy esté establecido
  if (!matchData.createdBy) {
    throw new Error('El campo createdBy es requerido');
  }
  
  // Validar que createdBy coincida con team1Player1Id (el creador debe ser team1Player1)
  if (matchData.createdBy && matchData.team1Player1Id && matchData.createdBy !== matchData.team1Player1Id) {
    throw new Error('El creador del partido debe ser team1Player1Id');
  }
  
  // Asegurar que team1Player1Id sea igual a createdBy si no está especificado
  if (!matchData.team1Player1Id) {
    matchData.team1Player1Id = matchData.createdBy;
  }
  
  return await Match.create(matchData);
};

// Actualizar un match
const updateMatch = async (id, updateData) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  
  // No permitir modificar createdBy (es inmutable)
  if (updateData.hasOwnProperty('createdBy')) {
    delete updateData.createdBy;
  }
  
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
  const { combineDateAndTime, validateMatchCreation } = await import('../utils/matchValidations.js');
  const transaction = await sequelize.transaction();
  
  try {
    // Extraer datos de la reserva y del partido
    const {
      slotId,
      userId,
      scheduledDate,
      notes
    } = matchData;

    // Validar que se proporcionen los datos necesarios
    if (!slotId || !scheduledDate) {
      throw new Error('slotId y scheduledDate son requeridos');
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

    // Validar creación del partido (fecha, día de semana, disponibilidad, etc.)
    const validation = await validateMatchCreation(scheduledDate, slot, slotId);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Calcular fechas/horas denormalizadas
    const scheduledDateTime = combineDateAndTime(scheduledDate, slot.startTime);
    const endDateTime = combineDateAndTime(scheduledDate, slot.endTime);

    // Crear la reserva de cancha con campos denormalizados
    const reservation = await CourtReservation.create({
      courtId: slot.courtId,
      userId,
      scheduledDate,
      slotId: slot.id,
      scheduledDateTime,  // ⭐ Campo denormalizado
      endDateTime,         // ⭐ Campo denormalizado
      price: slot.price,  // ⭐ Precio al momento de reserva
      status: 'confirmed' // La reserva se confirma automáticamente al crear el partido
    }, { transaction });

    // NO marcar el slot como no disponible (isAvailable es para admin, no para reservas)
    // El slot puede tener múltiples reservas en diferentes fechas

    // Crear el partido con campos denormalizados
    const match = await Match.create({
      reservationId: reservation.id,
      team1Player1Id: userId, // El creador siempre es team1Player1
      team1Player2Id: null,
      team2Player1Id: null,
      team2Player2Id: null,
      createdBy: userId,
      matchDateTime: scheduledDateTime,      // ⭐ Campo denormalizado
      matchEndDateTime: endDateTime,         // ⭐ Campo denormalizado
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
            }
            // ⭐ Slot removido - usar matchDateTime directamente
          ]
        },
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
// ⭐ Optimizado: Eliminado include de slot, ordenado por matchDateTime
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ],
    order: [['matchDateTime', 'ASC']] // ⭐ Ordenar por fecha del partido
  });
};

// Obtener un match por ID con información detallada
// ⭐ Optimizado: Eliminado include de slot
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ]
  });

  if (!match) {
    throw new Error('Match no encontrado');
  }

  return match;
};

// Obtener disponibilidad de equipos de un match
// ⭐ Optimizado: Eliminado include de slot
const getMatchTeamAvailability = async (matchId) => {
  const match = await Match.findByPk(matchId, {
    include: [
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      },
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
          }
          // ⭐ Slot removido - no necesario para disponibilidad
        ]
      }
    ]
  });

  if (!match) {
    throw new Error('Partido no encontrado');
  }

  const teamAvailability = getTeamAvailability(match);

  return {
    match,
    teams: teamAvailability,
    isFull: getAllMatchPlayers(match).length >= 4
  };
};

// Unirse a un partido
const joinMatch = async (matchId, userId, desiredTeam = null) => {
  const transaction = await sequelize.transaction();

  try {
    // Obtener el partido con información de los jugadores
    const match = await Match.findByPk(matchId, {
      include: [
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario no esté ya en el partido
    if (isUserInMatch(match, userId)) {
      throw new Error('Ya estás participando en este partido');
    }

    // Verificar que el partido no esté completo
    const allPlayers = getAllMatchPlayers(match);
    if (allPlayers.length >= 4) {
      throw new Error('El partido ya está completo (4 jugadores)');
    }

    let updateData = {};
    let position = '';

    if (desiredTeam !== null) {
      // Validar que el equipo sea válido (1 o 2)
      if (desiredTeam !== 1 && desiredTeam !== 2) {
        throw new Error('El equipo debe ser 1 o 2');
      }

      // Asignar al lugar disponible en el equipo elegido
      if (desiredTeam === 1) {
        // Equipo 1: solo team1Player2 está disponible (team1Player1 es el creador)
        if (!match.team1Player2Id) {
          updateData.team1Player2Id = userId;
          position = 'team1Player2';
        } else {
          throw new Error('El equipo 1 ya está completo');
        }
      } else if (desiredTeam === 2) {
        // Equipo 2: asignar a team2Player1 o team2Player2 según disponibilidad
        if (!match.team2Player1Id) {
          updateData.team2Player1Id = userId;
          position = 'team2Player1';
        } else if (!match.team2Player2Id) {
          updateData.team2Player2Id = userId;
          position = 'team2Player2';
        } else {
          throw new Error('El equipo 2 ya está completo');
        }
      }
    } else {
      // Asignación automática (fallback): team1Player2 → team2Player1 → team2Player2
      if (!match.team1Player2Id) {
        updateData.team1Player2Id = userId;
        position = 'team1Player2';
      } else if (!match.team2Player1Id) {
        updateData.team2Player1Id = userId;
        position = 'team2Player1';
      } else if (!match.team2Player2Id) {
        updateData.team2Player2Id = userId;
        position = 'team2Player2';
      } else {
        throw new Error('El partido ya está completo (4 jugadores)');
      }
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
            }
            // ⭐ Slot removido - usar matchDateTime directamente
          ]
        },
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
        }
      ],
      transaction
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Verificar que el usuario esté en el partido y obtener su posición
    let userPosition = null;
    
    if (match.team1Player1Id === userId) {
      userPosition = 'team1Player1';
    } else if (match.team1Player2Id === userId) {
      userPosition = 'team1Player2';
    } else if (match.team2Player1Id === userId) {
      userPosition = 'team2Player1';
    } else if (match.team2Player2Id === userId) {
      userPosition = 'team2Player2';
    }

    if (!userPosition) {
      throw new Error('No estás participando en este partido');
    }

    // No permitir que el creador (team1Player1) abandone el partido
    if (userPosition === 'team1Player1') {
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
    const position = userPosition;

    if (position === 'team1Player2') {
      updateData.team1Player2Id = null;
    } else if (position === 'team2Player1') {
      updateData.team2Player1Id = null;
    } else if (position === 'team2Player2') {
      updateData.team2Player2Id = null;
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
            }
            // ⭐ Slot removido - usar matchDateTime directamente
          ]
        },
        {
          association: 'team1Player1'
        },
        {
          association: 'team1Player2'
        },
        {
          association: 'team2Player1'
        },
        {
          association: 'team2Player2'
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
  if (!isUserInMatch(match, userId)) {
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
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
  if (!isUserInMatch(match, userId)) {
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ]
  });
};

// Confirmar un partido (pending_confirmation -> completed)
// NOTA: Este endpoint ahora está deprecado. El match se completa automáticamente
// cuando se confirma el score desde matchScoreService.confirmMatchScore
const confirmMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId, {
    include: [
      {
        association: 'score'
      }
    ]
  });
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  // Validar que existe un score confirmado
  if (!match.score || match.score.status !== 'confirmed') {
    throw new Error('No se puede confirmar un partido sin un resultado confirmado. Use el endpoint de confirmación de score.');
  }

  // Validar estado actual
  if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
    throw new Error(`No se puede confirmar un partido con estado: ${match.status}`);
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
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
  if (!isUserInMatch(match, userId)) {
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ]
  });
};

// Obtener todos los partidos en los que participa un usuario
// ⭐ Optimizado: Agregados filtros opcionales, eliminado include de slot, ordenado por matchDateTime
const getUserMatches = async (userId, filters = {}) => {
  // Si filters es un string (compatibilidad con código antiguo), convertirlo a objeto
  if (typeof filters === 'string') {
    filters = { status: filters };
  }
  
  const { status, upcoming, past } = filters;
  const now = new Date();
  
  const whereConditions = {
    [Op.or]: [
      { team1Player1Id: userId },
      { team1Player2Id: userId },
      { team2Player1Id: userId },
      { team2Player2Id: userId }
    ]
  };

  // Agregar filtro por status si se proporciona
  if (status) {
    // Validar que el status sea válido
    if (!Match.MATCH_STATUS_VALUES.includes(status)) {
      throw new Error(`Status inválido. Valores válidos: ${Match.MATCH_STATUS_VALUES.join(', ')}`);
    }
    whereConditions.status = status;
  }

  // ⭐ Nuevo: Filtrar por fecha usando matchDateTime
  if (upcoming) {
    whereConditions.matchDateTime = {
      [Op.gte]: now,
      [Op.not]: null
    };
  } else if (past) {
    whereConditions.matchDateTime = {
      [Op.lt]: now,
      [Op.not]: null
    };
  }

  return await Match.findAll({
    where: whereConditions,
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ],
    order: [['matchDateTime', 'ASC']] // ⭐ Ordenar por fecha del partido (próximos primero)
  });
};

// Obtener partidos disponibles para unirse
// ⭐ Optimizado: Usa matchDateTime directamente (campo denormalizado)
const getAvailableMatches = async (userId = null, filters = {}) => {
  const { dateFilter, availableSpaces } = filters;
  
  const now = new Date();
  
  // Construir condiciones: partidos scheduled que no estén completos
  const whereConditions = {
    status: Match.MATCH_STATUS.SCHEDULED,
    matchDateTime: { 
      [Op.gte]: now, // Solo partidos futuros
      [Op.not]: null
    },
    [Op.or]: [
      { team1Player2Id: null },
      { team2Player1Id: null },
      { team2Player2Id: null }
    ]
  };

  // ⭐ Optimizado: Filtrar por matchDateTime directamente (sin join con reservation)
  if (dateFilter) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfToday = new Date(today);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endOfWeek = new Date(nextWeek);
    endOfWeek.setHours(23, 59, 59, 999);

    switch (dateFilter) {
      case 'today':
        whereConditions.matchDateTime = {
          [Op.gte]: startOfToday,
          [Op.lte]: endOfToday,
          [Op.not]: null
        };
        break;
      case 'tomorrow':
        whereConditions.matchDateTime = {
          [Op.gte]: startOfTomorrow,
          [Op.lte]: endOfTomorrow,
          [Op.not]: null
        };
        break;
      case 'thisWeek':
        whereConditions.matchDateTime = {
          [Op.gte]: startOfToday,
          [Op.lte]: endOfWeek,
          [Op.not]: null
        };
        break;
    }
  }

  const matches = await Match.findAll({
    where: whereConditions,
    include: [
      {
        association: 'reservation',
        required: true,
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
          }
          // ⭐ Slot removido - usar matchDateTime directamente
        ]
      },
      {
        association: 'team1Player1'
      },
      {
        association: 'team1Player2'
      },
      {
        association: 'team2Player1'
      },
      {
        association: 'team2Player2'
      }
    ],
    order: [
      ['matchDateTime', 'ASC'] // ⭐ Ordenar por fecha del partido (próximos primero)
    ]
  });

  // Aplicar filtro de espacios disponibles
  let filteredMatches = matches;
  if (availableSpaces) {
    filteredMatches = matches.filter(match => {
      const playersCount = getAllMatchPlayers(match).length;
      const availableSpots = 4 - playersCount;
      
      if (availableSpaces === 'one') {
        return availableSpots === 1; // Exactamente 1 espacio (3 jugadores)
      } else if (availableSpaces === 'twoOrMore') {
        return availableSpots >= 2; // 2 o más espacios (2 o menos jugadores)
      }
      
      return true;
    });
  }

  // Si se proporciona un userId, filtrar partidos donde el usuario ya está participando
  if (userId) {
    filteredMatches = filteredMatches.filter(match => !isUserInMatch(match, userId));
  }

  return filteredMatches;
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
  getMatchTeamAvailability,
  joinMatch,
  leaveMatch,
  startMatch,
  finishMatch,
  confirmMatch,
  cancelMatch,
  getUserMatches,
  getAvailableMatches
};