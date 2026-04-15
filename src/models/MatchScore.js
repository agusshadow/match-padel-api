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
  match_id: {
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
  winner_team: {
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
  confirmed_by: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  rejected_by: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  confirmation_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejection_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejected_at: {
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
      // Si se confirma, establecer confirmed_at
      if (matchScore.changed('status') && matchScore.status === SCORE_STATUS.CONFIRMED) {
        if (!matchScore.confirmed_at) {
          matchScore.confirmed_at = new Date();
        }
      }
      // Si se rechaza, establecer rejected_at
      if (matchScore.changed('status') && matchScore.status === SCORE_STATUS.REJECTED) {
        if (!matchScore.rejected_at) {
          matchScore.rejected_at = new Date();
        }
      }
    }
  }
});

// Métodos estáticos
MatchScore.SCORE_STATUS = SCORE_STATUS;
MatchScore.SCORE_STATUS_VALUES = SCORE_STATUS_VALUES;

export default MatchScore;
