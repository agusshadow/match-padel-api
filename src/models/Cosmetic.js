import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const COSMETIC_TYPE = {
  PALETTE: 'palette'
};

const COSMETIC_TYPE_VALUES = Object.values(COSMETIC_TYPE);

const ACQUISITION_METHOD = {
  FREE: 'free',
  CHALLENGE: 'challenge',
  PURCHASE: 'purchase'
};

const ACQUISITION_METHOD_VALUES = Object.values(ACQUISITION_METHOD);

const Cosmetic = sequelize.define('Cosmetic', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Nombre del cosmético'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción del cosmético'
  },
  type: {
    type: DataTypes.ENUM(...COSMETIC_TYPE_VALUES),
    allowNull: false,
    defaultValue: COSMETIC_TYPE.PALETTE,
    validate: {
      isIn: [COSMETIC_TYPE_VALUES]
    },
    comment: 'Tipo de cosmético'
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'URL completa de la imagen en el bucket público'
  },
  acquisitionMethod: {
    type: DataTypes.ENUM(...ACQUISITION_METHOD_VALUES),
    allowNull: false,
    validate: {
      isIn: [ACQUISITION_METHOD_VALUES]
    },
    comment: 'Método de adquisición: free, challenge, purchase'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'Precio si es comprable (NULL si no es comprable)'
  },
  challengeId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'challenges',
      key: 'id'
    },
    comment: 'ID del desafío si se obtiene por desafío'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Si el cosmético está activo y disponible'
  }
}, {
  tableName: 'cosmetics',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['acquisition_method']
    },
    {
      fields: ['challenge_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['type']
    }
  ]
});

Cosmetic.COSMETIC_TYPE = COSMETIC_TYPE;
Cosmetic.COSMETIC_TYPE_VALUES = COSMETIC_TYPE_VALUES;
Cosmetic.ACQUISITION_METHOD = ACQUISITION_METHOD;
Cosmetic.ACQUISITION_METHOD_VALUES = ACQUISITION_METHOD_VALUES;

export default Cosmetic;
export { COSMETIC_TYPE, COSMETIC_TYPE_VALUES, ACQUISITION_METHOD, ACQUISITION_METHOD_VALUES };
