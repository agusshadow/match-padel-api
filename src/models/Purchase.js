import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para métodos de pago
const PAYMENT_METHOD = {
  MOCK: 'mock',
  MERCADOPAGO: 'mercadopago'
};

const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);

// Constantes para estados de pago
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

const Purchase = sequelize.define('Purchase', {
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
    comment: 'ID del usuario que compró'
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
    comment: 'ID del cosmético comprado'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    },
    comment: 'Precio pagado'
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: PAYMENT_METHOD.MOCK,
    comment: 'Método de pago utilizado'
  },
  paymentStatus: {
    type: DataTypes.ENUM(...PAYMENT_STATUS_VALUES),
    allowNull: false,
    defaultValue: PAYMENT_STATUS.COMPLETED,
    validate: {
      isIn: [PAYMENT_STATUS_VALUES]
    },
    comment: 'Estado del pago'
  },
  purchasedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha de compra'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Datos adicionales del pago (para Mercado Pago cuando se implemente)'
  }
}, {
  tableName: 'purchases',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['cosmeticId']
    },
    {
      fields: ['paymentStatus']
    },
    {
      fields: ['paymentMethod']
    }
  ]
});

// Exportar constantes
Purchase.PAYMENT_METHOD = PAYMENT_METHOD;
Purchase.PAYMENT_METHOD_VALUES = PAYMENT_METHOD_VALUES;
Purchase.PAYMENT_STATUS = PAYMENT_STATUS;
Purchase.PAYMENT_STATUS_VALUES = PAYMENT_STATUS_VALUES;

export default Purchase;
export { PAYMENT_METHOD, PAYMENT_METHOD_VALUES, PAYMENT_STATUS, PAYMENT_STATUS_VALUES };

