import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const MatchParticipant = sequelize.define('MatchParticipant', {
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
    onDelete: 'CASCADE'
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  team_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isIn: [[1, 2]]
    }
  },
  position: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'left, right, or single'
  }
}, {
  tableName: 'match_participants',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['match_id', 'user_id'],
      name: 'idx_match_participants_unique_user'
    },
    {
      fields: ['user_id'],
      name: 'idx_match_participants_user_id'
    }
  ]
});

export default MatchParticipant;
