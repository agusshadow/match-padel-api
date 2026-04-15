import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const CourtSlot = sequelize.define('CourtSlot', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  courtId: {
    type: DataTypes.BIGINT,
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
  underscored: true,
  paranoid: false,
  indexes: [
    {
      unique: true,
      fields: ['court_id', 'day_of_week', 'start_time']
    }
  ]
});

export default CourtSlot;
