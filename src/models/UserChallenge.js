import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para estados de desafíos de usuario
const USER_CHALLENGE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CLAIMED: 'claimed',
  EXPIRED: 'expired'
};

const USER_CHALLENGE_STATUS_VALUES = Object.values(USER_CHALLENGE_STATUS);

const UserChallenge = sequelize.define('UserChallenge', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: 'ID del usuario'
  },
  challengeId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'challenges',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: 'ID del desafío'
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha de asignación del desafío'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Fecha de expiración del desafío'
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Progreso actual del desafío'
  },
  status: {
    type: DataTypes.ENUM(...USER_CHALLENGE_STATUS_VALUES),
    allowNull: false,
    defaultValue: USER_CHALLENGE_STATUS.PENDING,
    validate: {
      isIn: [USER_CHALLENGE_STATUS_VALUES]
    },
    comment: 'Estado del desafío'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha de completado del desafío'
  },
  claimedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha de reclamación de la recompensa'
  }
}, {
  tableName: 'user_challenges',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['user_id', 'expires_at']
    },
    {
      fields: ['challenge_id']
    },
    {
      fields: ['user_id', 'challenge_id', 'status']
    }
  ]
});

// Exportar constantes
UserChallenge.USER_CHALLENGE_STATUS = USER_CHALLENGE_STATUS;
UserChallenge.USER_CHALLENGE_STATUS_VALUES = USER_CHALLENGE_STATUS_VALUES;

export default UserChallenge;
export { USER_CHALLENGE_STATUS, USER_CHALLENGE_STATUS_VALUES };
