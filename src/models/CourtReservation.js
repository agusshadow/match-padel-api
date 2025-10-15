const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

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
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  courtId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'courts',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
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
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...RESERVATION_STATUS_VALUES),
    defaultValue: RESERVATION_STATUS.PENDING,
    allowNull: false,
    validate: {
      isIn: [RESERVATION_STATUS_VALUES]
    }
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'court_reservations',
  timestamps: true,
  paranoid: false
});

// Exportar constantes para uso en otros archivos
CourtReservation.RESERVATION_STATUS = RESERVATION_STATUS;
CourtReservation.RESERVATION_STATUS_VALUES = RESERVATION_STATUS_VALUES;
CourtReservation.RESERVATION_DURATION_MINUTES = RESERVATION_DURATION_MINUTES;

module.exports = CourtReservation;
