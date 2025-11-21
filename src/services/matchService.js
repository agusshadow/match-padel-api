import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
import CourtSlot from '../models/CourtSlot.js';
import { sequelize } from '../config/connection.js';
import { Op } from 'sequelize';

const getAllMatchPlayers = (match) => {
  return [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].filter(id => id !== null);
};

const isUserInMatch = (match, userId) => {
  return getAllMatchPlayers(match).includes(userId);
};

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

const getAllMatches = async () => {
  return await Match.findAll();
};

const getMatchById = async (id) => {
  return await Match.findByPk(id);
};

const createMatch = async (matchData) => {
  if (!matchData.createdBy) {
    throw new Error('El campo createdBy es requerido');
  }
  
  if (matchData.createdBy && matchData.team1Player1Id && matchData.createdBy !== matchData.team1Player1Id) {
    throw new Error('El creador del partido debe ser team1Player1Id');
  }
  
  if (!matchData.team1Player1Id) {
    matchData.team1Player1Id = matchData.createdBy;
  }
  
  return await Match.create(matchData);
};

const updateMatch = async (id, updateData) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  
  if (updateData.hasOwnProperty('createdBy')) {
    delete updateData.createdBy;
  }
  
  return await match.update(updateData);
};

const deleteMatch = async (id) => {
  const match = await Match.findByPk(id);
  if (!match) throw new Error('Match no encontrado');
  return await match.destroy();
};

const createMatchWithReservation = async (matchData) => {
  const { combineDateAndTime, validateMatchCreation } = await import('../utils/matchValidations.js');
  const transaction = await sequelize.transaction();
  
  try {
    const {
      slotId,
      userId,
      scheduledDate,
      notes
    } = matchData;

    if (!slotId || !scheduledDate) {
      throw new Error('slotId y scheduledDate son requeridos');
    }

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

    const validation = await validateMatchCreation(scheduledDate, slot, slotId);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const scheduledDateTime = combineDateAndTime(scheduledDate, slot.startTime);
    const endDateTime = combineDateAndTime(scheduledDate, slot.endTime);

    const reservation = await CourtReservation.create({
      courtId: slot.courtId,
      userId,
      scheduledDate,
      slotId: slot.id,
      scheduledDateTime,
      endDateTime,
      price: slot.price,
      status: 'confirmed'
    }, { transaction });

    const match = await Match.create({
      reservationId: reservation.id,
      team1Player1Id: userId,
      team1Player2Id: null,
      team2Player1Id: null,
      team2Player2Id: null,
      createdBy: userId,
      matchDateTime: scheduledDateTime,
      matchEndDateTime: endDateTime,
      status: Match.MATCH_STATUS.SCHEDULED,
      notes
    }, { transaction });

    await transaction.commit();

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
    await transaction.rollback();
    throw error;
  }
};

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
        association: 'team1Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team1Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      }
    ],
    order: [['matchDateTime', 'ASC']]
  });
};

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
        association: 'team1Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team1Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      }
    ]
  });

  if (!match) {
    throw new Error('Match no encontrado');
  }

  return match;
};

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

const joinMatch = async (matchId, userId, desiredTeam = null) => {
  const transaction = await sequelize.transaction();

  try {
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

    if (isUserInMatch(match, userId)) {
      throw new Error('Ya estás participando en este partido');
    }

    const allPlayers = getAllMatchPlayers(match);
    if (allPlayers.length >= 4) {
      throw new Error('El partido ya está completo (4 jugadores)');
    }

    let updateData = {};
    let position = '';

    if (desiredTeam !== null) {
      if (desiredTeam !== 1 && desiredTeam !== 2) {
        throw new Error('El equipo debe ser 1 o 2');
      }

      if (desiredTeam === 1) {
        if (!match.team1Player2Id) {
          updateData.team1Player2Id = userId;
          position = 'team1Player2';
        } else {
          throw new Error('El equipo 1 ya está completo');
        }
      } else if (desiredTeam === 2) {
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

    await match.update(updateData, { transaction });

    await transaction.commit();

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
    await transaction.rollback();
    throw error;
  }
};

const leaveMatch = async (matchId, userId) => {
  const transaction = await sequelize.transaction();

  try {
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

    if (userPosition === 'team1Player1') {
      throw new Error('El creador del partido no puede abandonarlo. Si deseas cancelar el partido, debes eliminarlo');
    }

    if (
      match.status === Match.MATCH_STATUS.IN_PROGRESS ||
      match.status === Match.MATCH_STATUS.PENDING_CONFIRMATION ||
      match.status === Match.MATCH_STATUS.COMPLETED
    ) {
      throw new Error('No puedes abandonar un partido que ya está en progreso, pendiente de confirmación o completado');
    }

    let updateData = {};
    const position = userPosition;

    if (position === 'team1Player2') {
      updateData.team1Player2Id = null;
    } else if (position === 'team2Player1') {
      updateData.team2Player1Id = null;
    } else if (position === 'team2Player2') {
      updateData.team2Player2Id = null;
    }

    await match.update(updateData, { transaction });

    await transaction.commit();

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
    await transaction.rollback();
    throw error;
  }
};

const startMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  if (!isUserInMatch(match, userId)) {
    throw new Error('Solo los jugadores del partido pueden iniciarlo');
  }

  if (match.status !== Match.MATCH_STATUS.SCHEDULED) {
    throw new Error(`No se puede iniciar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.IN_PROGRESS });

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

const finishMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  if (!isUserInMatch(match, userId)) {
    throw new Error('Solo los jugadores del partido pueden finalizarlo');
  }

  if (match.status !== Match.MATCH_STATUS.IN_PROGRESS) {
    throw new Error(`No se puede finalizar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.PENDING_CONFIRMATION });

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

  if (!match.score || match.score.status !== 'confirmed') {
    throw new Error('No se puede confirmar un partido sin un resultado confirmado. Use el endpoint de confirmación de score.');
  }

  if (match.status !== Match.MATCH_STATUS.PENDING_CONFIRMATION) {
    throw new Error(`No se puede confirmar un partido con estado: ${match.status}`);
  }

  await match.update({ status: Match.MATCH_STATUS.COMPLETED });

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

const cancelMatch = async (matchId, userId) => {
  const match = await Match.findByPk(matchId);
  
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  if (!isUserInMatch(match, userId)) {
    throw new Error('Solo los jugadores del partido pueden cancelarlo');
  }

  if (match.status === Match.MATCH_STATUS.CANCELLED) {
    throw new Error('El partido ya está cancelado');
  }

  if (match.status === Match.MATCH_STATUS.COMPLETED) {
    throw new Error('No se puede cancelar un partido completado');
  }

  await match.update({ status: Match.MATCH_STATUS.CANCELLED });

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

const getUserMatches = async (userId, filters = {}) => {
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

  if (status) {
    if (!Match.MATCH_STATUS_VALUES.includes(status)) {
      throw new Error(`Status inválido. Valores válidos: ${Match.MATCH_STATUS_VALUES.join(', ')}`);
    }
    whereConditions.status = status;
  }

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
        association: 'team1Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team1Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      }
    ],
    order: [['matchDateTime', 'ASC']]
  });
};

const getAvailableMatches = async (userId = null, filters = {}) => {
  const { dateFilter, availableSpaces } = filters;
  
  const now = new Date();
  
  const whereConditions = {
    status: Match.MATCH_STATUS.SCHEDULED,
    matchDateTime: { 
      [Op.gte]: now,
      [Op.not]: null
    },
    [Op.or]: [
      { team1Player2Id: null },
      { team2Player1Id: null },
      { team2Player2Id: null }
    ]
  };

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
        association: 'team1Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team1Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player1',
        include: [
          {
            association: 'profile'
          }
        ]
      },
      {
        association: 'team2Player2',
        include: [
          {
            association: 'profile'
          }
        ]
      }
    ],
    order: [
      ['matchDateTime', 'ASC']
    ]
  });

  let filteredMatches = matches;
  if (availableSpaces) {
    filteredMatches = matches.filter(match => {
      const playersCount = getAllMatchPlayers(match).length;
      const availableSpots = 4 - playersCount;
      
      if (availableSpaces === 'one') {
        return availableSpots === 1;
      } else if (availableSpaces === 'twoOrMore') {
        return availableSpots >= 2;
      }
      
      return true;
    });
  }

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