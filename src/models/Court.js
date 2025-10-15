const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

// Constantes para tipos de cancha
const COURT_TYPE = {
  INDOOR: 'indoor',
  OUTDOOR: 'outdoor',
  COVERED: 'covered'
};

const COURT_TYPE_VALUES = Object.values(COURT_TYPE);

// Constantes para superficies de cancha
const COURT_SURFACE = {
  SYNTHETIC: 'synthetic',
  CEMENT: 'cement',
  GRASS: 'grass'
};

const COURT_SURFACE_VALUES = Object.values(COURT_SURFACE);

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
    type: DataTypes.ENUM(...COURT_TYPE_VALUES),
    allowNull: false,
    validate: {
      isIn: [COURT_TYPE_VALUES]
    }
  },
  surface: {
    type: DataTypes.ENUM(...COURT_SURFACE_VALUES),
    allowNull: false,
    validate: {
      isIn: [COURT_SURFACE_VALUES]
    }
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

// Exportar constantes para uso en otros archivos
Court.COURT_TYPE = COURT_TYPE;
Court.COURT_TYPE_VALUES = COURT_TYPE_VALUES;
Court.COURT_SURFACE = COURT_SURFACE;
Court.COURT_SURFACE_VALUES = COURT_SURFACE_VALUES;

module.exports = Court;
