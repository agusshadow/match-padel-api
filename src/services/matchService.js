import Match from '../models/Match.js';
import CourtReservation from '../models/CourtReservation.js';
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
      courtId,
      userId,
      scheduledDate,
      startTime,
      endTime,
      totalPrice,
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

    // Crear la reserva de cancha
    const reservation = await CourtReservation.create({
      courtId,
      userId,
      scheduledDate,
      startTime,
      endTime,
      totalPrice,
      status: 'confirmed' // La reserva se confirma automáticamente al crear el partido
    }, { transaction });

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
  getAllMatchesDetailed
};