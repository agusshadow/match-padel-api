import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para estados de partidos
const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  PENDING_CONFIRMATION: 'pending_confirmation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const MATCH_STATUS_VALUES = Object.values(MATCH_STATUS);

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'court_reservations',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player1Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player2Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player3Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player4Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  status: {
    type: DataTypes.ENUM(...MATCH_STATUS_VALUES),
    defaultValue: MATCH_STATUS.SCHEDULED,
    allowNull: false,
    validate: {
      isIn: [MATCH_STATUS_VALUES]
    }
  },
  score: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isValidScore(value) {
        if (value && typeof value === 'object') {
          if (!value.sets || !Array.isArray(value.sets)) {
            throw new Error('Score debe tener un array de sets');
          }
          if (!value.winner || !['team1', 'team2'].includes(value.winner)) {
            throw new Error('Score debe tener un winner válido (team1 o team2)');
          }
        }
      }
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'matches',
  timestamps: true,
  paranoid: false,
  validate: {
    validatePlayers() {
      // Mínimo 1 jugador requerido (el creador), máximo 4
      if (!this.player1Id) {
        throw new Error('Los partidos requieren al menos 1 jugador (el creador)');
      }
    },
    validateUniquePlayers() {
      const players = [this.player1Id, this.player2Id, this.player3Id, this.player4Id].filter(Boolean);
      const uniquePlayers = [...new Set(players)];
      if (players.length !== uniquePlayers.length) {
        throw new Error('Los jugadores deben ser únicos');
      }
    }
  }
});

// Exportar constantes para uso en otros archivos
Match.MATCH_STATUS = MATCH_STATUS;
Match.MATCH_STATUS_VALUES = MATCH_STATUS_VALUES;

export default Match;
