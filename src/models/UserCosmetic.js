import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para métodos de adquisición del usuario
const ACQUIRED_METHOD = {
  FREE: 'free',
  CHALLENGE: 'challenge',
  PURCHASE: 'purchase'
};

const ACQUIRED_METHOD_VALUES = Object.values(ACQUIRED_METHOD);

const UserCosmetic = sequelize.define('UserCosmetic', {
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
    onDelete: 'CASCADE',
    comment: 'ID del usuario'
  },
  cosmeticId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cosmetics',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: 'ID del cosmético'
  },
  acquiredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha de adquisición'
  },
  acquiredMethod: {
    type: DataTypes.ENUM(...ACQUIRED_METHOD_VALUES),
    allowNull: false,
    validate: {
      isIn: [ACQUIRED_METHOD_VALUES]
    },
    comment: 'Método de adquisición'
  },
  purchaseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'purchases',
      key: 'id'
    },
    comment: 'ID de la compra si fue adquirido por compra'
  },
  challengeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'challenges',
      key: 'id'
    },
    comment: 'ID del desafío si fue adquirido por desafío'
  },
  isEquipped: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Si el cosmético está equipado'
  }
}, {
  tableName: 'user_cosmetics',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['userId', 'isEquipped']
    },
    {
      fields: ['cosmeticId']
    },
    {
      unique: true,
      fields: ['userId', 'cosmeticId'],
      name: 'user_cosmetics_userId_cosmeticId_unique'
    }
  ]
});

// Exportar constantes
UserCosmetic.ACQUIRED_METHOD = ACQUIRED_METHOD;
UserCosmetic.ACQUIRED_METHOD_VALUES = ACQUIRED_METHOD_VALUES;

export default UserCosmetic;
export { ACQUIRED_METHOD, ACQUIRED_METHOD_VALUES };

