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
  team1Player1Id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Se cambiará a NOT NULL después de backfill
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  team1Player2Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  team2Player1Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  team2Player2Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  // Campos denormalizados para mejor performance
  matchDateTime: {
    type: DataTypes.DATE,
    allowNull: true // Permitir null para datos existentes
  },
  matchEndDateTime: {
    type: DataTypes.DATE,
    allowNull: true // Permitir null para datos existentes
  },
  status: {
    type: DataTypes.ENUM(...MATCH_STATUS_VALUES),
    defaultValue: MATCH_STATUS.SCHEDULED,
    allowNull: false,
    validate: {
      isIn: [MATCH_STATUS_VALUES]
    }
  },
  // Campos de auditoría
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  finishedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelledBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
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
    validateTeams() {
      // El creador debe estar en team1Player1Id
      if (this.createdBy && this.team1Player1Id && this.createdBy !== this.team1Player1Id) {
        throw new Error('El creador del partido debe ser team1Player1Id');
      }
      
      // Validar que no haya jugadores duplicados entre equipos
      const players = [
        this.team1Player1Id,
        this.team1Player2Id,
        this.team2Player1Id,
        this.team2Player2Id
      ].filter(Boolean);
      
      const uniquePlayers = [...new Set(players)];
      if (players.length !== uniquePlayers.length) {
        throw new Error('Los jugadores deben ser únicos entre equipos');
      }
    }
  }
});

// Exportar constantes para uso en otros archivos
Match.MATCH_STATUS = MATCH_STATUS;
Match.MATCH_STATUS_VALUES = MATCH_STATUS_VALUES;

export default Match;
