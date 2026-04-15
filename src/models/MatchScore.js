import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

export const SCORE_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected'
};

export const SCORE_STATUS_VALUES = Object.values(SCORE_STATUS);

const MatchScore = sequelize.define('MatchScore', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  matchId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'matches',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    unique: true
  },
  winnerTeam: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isIn: [[1, 2]]
    }
  },
  status: {
    type: DataTypes.ENUM(...SCORE_STATUS_VALUES),
    defaultValue: SCORE_STATUS.PENDING_CONFIRMATION,
    allowNull: false,
    validate: {
      isIn: [SCORE_STATUS_VALUES]
    }
  },
  confirmedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  rejectedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  confirmationComment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejectionComment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'match_scores',
  timestamps: true,
  underscored: true,
  paranoid: false,
  hooks: {
    beforeUpdate: async (matchScore, options) => {
      // Si se confirma, establecer confirmedAt
      if (matchScore.changed('status') && matchScore.status === SCORE_STATUS.CONFIRMED) {
        if (!matchScore.confirmedAt) {
          matchScore.confirmedAt = new Date();
        }
      }
      // Si se rechaza, establecer rejectedAt
      if (matchScore.changed('status') && matchScore.status === SCORE_STATUS.REJECTED) {
        if (!matchScore.rejectedAt) {
          matchScore.rejectedAt = new Date();
        }
      }
    }
  }
});

// Métodos estáticos
MatchScore.SCORE_STATUS = SCORE_STATUS;
MatchScore.SCORE_STATUS_VALUES = SCORE_STATUS_VALUES;

export default MatchScore;
