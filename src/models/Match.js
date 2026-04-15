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
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'court_reservations',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  createdBy: {
    type: DataTypes.BIGINT,
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
  // Campos de auditoría
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  finished_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.BIGINT,
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
  underscored: true,
  paranoid: false
});

// Exportar constantes para uso en otros archivos
Match.MATCH_STATUS = MATCH_STATUS;
Match.MATCH_STATUS_VALUES = MATCH_STATUS_VALUES;

export default Match;
