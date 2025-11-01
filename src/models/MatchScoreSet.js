import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const MatchScoreSet = sequelize.define('MatchScoreSet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  matchScoreId: {
    type: DataTypes.INTEGER,
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
  paranoid: false,
  indexes: [
    {
      unique: true,
      fields: ['matchScoreId', 'setNumber']
    }
  ]
});

export default MatchScoreSet;

