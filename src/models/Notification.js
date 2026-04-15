import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para tipos de notificaciones
const NOTIFICATION_TYPE = {
  LEVEL_UP: 'LEVEL_UP',
  ACHIEVEMENT: 'ACHIEVEMENT',
  MATCH_COMPLETED: 'MATCH_COMPLETED'
};

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
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
  type: {
    type: DataTypes.ENUM(...NOTIFICATION_TYPE_VALUES),
    allowNull: false,
    validate: {
      isIn: [NOTIFICATION_TYPE_VALUES]
    }
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data for the notification (e.g., levelUp info)'
  },
  read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['read']
    },
    {
      fields: ['user_id', 'read']
    }
  ]
});

// Exportar constantes para uso en otros archivos
Notification.NOTIFICATION_TYPE = NOTIFICATION_TYPE;
Notification.NOTIFICATION_TYPE_VALUES = NOTIFICATION_TYPE_VALUES;

export default Notification;
export { NOTIFICATION_TYPE, NOTIFICATION_TYPE_VALUES };
