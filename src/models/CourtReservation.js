import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para estados de reservas
const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const RESERVATION_STATUS_VALUES = Object.values(RESERVATION_STATUS);

// Duración fija de las reservas (90 minutos)
const RESERVATION_DURATION_MINUTES = 90;

const CourtReservation = sequelize.define('CourtReservation', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  court_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'courts',
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
  scheduled_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  slot_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // Permitir null para datos existentes (se cambiará a NOT NULL después)
    references: {
      model: 'court_slots',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  // Campos denormalizados para mejor performance
  scheduled_date_time: {
    type: DataTypes.DATE,
    allowNull: true // Permitir null para datos existentes
  },
  end_date_time: {
    type: DataTypes.DATE,
    allowNull: true // Permitir null para datos existentes
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true // Permitir null para datos existentes
  },
  status: {
    type: DataTypes.ENUM(...RESERVATION_STATUS_VALUES),
    defaultValue: RESERVATION_STATUS.PENDING,
    allowNull: false,
    validate: {
      isIn: [RESERVATION_STATUS_VALUES]
    }
  }
}, {
  tableName: 'court_reservations',
  timestamps: true,
  underscored: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Exportar constantes para uso en otros archivos
CourtReservation.RESERVATION_STATUS = RESERVATION_STATUS;
CourtReservation.RESERVATION_STATUS_VALUES = RESERVATION_STATUS_VALUES;
CourtReservation.RESERVATION_DURATION_MINUTES = RESERVATION_DURATION_MINUTES;

export default CourtReservation;
