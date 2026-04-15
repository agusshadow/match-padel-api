import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para tipos de desafíos
const CHALLENGE_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

const CHALLENGE_TYPE_VALUES = Object.values(CHALLENGE_TYPE);

// Constantes para tipos de recompensas
const REWARD_TYPE = {
  XP: 'xp',
  COSMETIC: 'cosmetic',
  BOTH: 'both'
};

const REWARD_TYPE_VALUES = Object.values(REWARD_TYPE);

const Challenge = sequelize.define('Challenge', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Título del desafío'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción del desafío'
  },
  type: {
    type: DataTypes.ENUM(...CHALLENGE_TYPE_VALUES),
    allowNull: false,
    comment: 'Tipo de desafío: daily, weekly, monthly',
    validate: {
      isIn: [CHALLENGE_TYPE_VALUES]
    }
  },
  action_type: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Tipo de acción que completa el desafío (PLAY_MATCH, WIN_MATCH, etc.)'
  },
  target_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    },
    comment: 'Valor objetivo a alcanzar'
  },
  reward_type: {
    type: DataTypes.ENUM(...REWARD_TYPE_VALUES),
    allowNull: false,
    comment: 'Tipo de recompensa',
    validate: {
      isIn: [REWARD_TYPE_VALUES]
    }
  },
  reward_xp: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'Cantidad de XP como recompensa'
  },
  reward_cosmetic_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'cosmetics',
      key: 'id'
    },
    comment: 'ID del cosmético como recompensa'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Si el desafío está activo y disponible'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Configuraciones adicionales del desafío'
  }
}, {
  tableName: 'challenges',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['action_type']
    }
  ]
});

// Exportar constantes
Challenge.CHALLENGE_TYPE = CHALLENGE_TYPE;
Challenge.CHALLENGE_TYPE_VALUES = CHALLENGE_TYPE_VALUES;
Challenge.REWARD_TYPE = REWARD_TYPE;
Challenge.REWARD_TYPE_VALUES = REWARD_TYPE_VALUES;

export default Challenge;
export { CHALLENGE_TYPE, CHALLENGE_TYPE_VALUES, REWARD_TYPE, REWARD_TYPE_VALUES };
