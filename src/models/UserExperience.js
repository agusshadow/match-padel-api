import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para tipos de acciones
const EXPERIENCE_ACTION = {
  PLAY_MATCH: 'PLAY_MATCH',
  WIN_MATCH: 'WIN_MATCH',
  COMPLETE_PROFILE: 'COMPLETE_PROFILE'
};

const EXPERIENCE_ACTION_VALUES = Object.values(EXPERIENCE_ACTION);

const UserExperience = sequelize.define('UserExperience', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  xpAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional context for the action (e.g., matchId)'
  }
}, {
  tableName: 'user_experience',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['action']
    },
    {
      fields: ['userId', 'action']
    }
  ]
});

// Exportar constantes para uso en otros archivos
UserExperience.EXPERIENCE_ACTION = EXPERIENCE_ACTION;
UserExperience.EXPERIENCE_ACTION_VALUES = EXPERIENCE_ACTION_VALUES;

export default UserExperience;
export { EXPERIENCE_ACTION, EXPERIENCE_ACTION_VALUES };

