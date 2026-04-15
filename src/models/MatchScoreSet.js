import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const MatchScoreSet = sequelize.define('MatchScoreSet', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  matchScoreId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'match_scores',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  setNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  team1Score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  team2Score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'match_score_sets',
  timestamps: true,
  underscored: true,
  paranoid: false,
  indexes: [
    {
      unique: true,
      fields: ['match_score_id', 'set_number']
    }
  ]
});

export default MatchScoreSet;
