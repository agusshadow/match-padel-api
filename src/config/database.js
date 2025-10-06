const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración simple de Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME || 'match_padel',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Cambiar a console.log para ver las consultas SQL
  }
);

module.exports = sequelize;