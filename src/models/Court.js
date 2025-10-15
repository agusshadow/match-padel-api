const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

const Court = sequelize.define('Court', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clubId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clubs',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    }
  },
  type: {
    type: DataTypes.ENUM('indoor', 'outdoor', 'covered'),
    allowNull: false
  },
  surface: {
    type: DataTypes.ENUM('synthetic', 'cement', 'grass'),
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'courts',
  timestamps: true,
  paranoid: false
});

module.exports = Court;
