const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

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
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isIn: [[60, 90]]
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'confirmed', 'cancelled', 'completed']]
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

module.exports = CourtReservation;
