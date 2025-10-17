import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const CourtSlot = sequelize.define('CourtSlot', {
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
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    }
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'court_slots',
  timestamps: true,
  paranoid: false,
  indexes: [
    {
      unique: true,
      fields: ['courtId', 'dayOfWeek', 'startTime']
    }
  ]
});

export default CourtSlot;
