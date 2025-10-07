const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/connection');
const User = require('./models/User');
const routes = require('./routes');

const app = express();

// Middleware básico
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api', routes);

// Inicializar base de datos y servidor
const startServer = async () => {
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a MySQL');

    // Sincronizar modelos (crear tablas)
    await sequelize.sync({ force: false }); // Cambiar a true para recrear tablas
    console.log('✅ Base de datos sincronizada');

    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor en puerto ${PORT}`);
      console.log(`📋 Endpoints:`);
      console.log(`   POST /api/auth/register - Registro`);
      console.log(`   POST /api/auth/login - Login`);
      console.log(`   GET  /api/auth/profile - Perfil (requiere token)`);
      console.log(`   GET  /api/health - Estado del servidor`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
