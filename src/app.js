const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./config/connection');
const routes = require('./routes');

// Importar y configurar asociaciones entre modelos
require('./models/associations');

const app = express();

// Las asociaciones entre modelos están definidas en ./models/associations.js

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
      console.log(`   GET  /api/clubs - Obtener todos los clubs`);
      console.log(`   GET  /api/clubs/:id - Obtener club por ID`);
      console.log(`   POST /api/clubs - Crear club (requiere token)`);
      console.log(`   PUT  /api/clubs/:id - Actualizar club (requiere token)`);
      console.log(`   DELETE /api/clubs/:id - Eliminar club (requiere token)`);
      console.log(`   GET  /api/courts - Obtener todas las canchas`);
      console.log(`   GET  /api/courts/:id - Obtener cancha por ID`);
      console.log(`   POST /api/courts - Crear cancha (requiere token)`);
      console.log(`   PUT  /api/courts/:id - Actualizar cancha (requiere token)`);
      console.log(`   DELETE /api/courts/:id - Eliminar cancha (requiere token)`);
      console.log(`   GET  /api/matches - Obtener todos los matches`);
      console.log(`   GET  /api/matches/:id - Obtener match por ID`);
      console.log(`   POST /api/matches - Crear match (requiere token)`);
      console.log(`   PUT  /api/matches/:id - Actualizar match (requiere token)`);
      console.log(`   DELETE /api/matches/:id - Eliminar match (requiere token)`);
      console.log(`   PUT  /api/matches/:id/start - Iniciar match (requiere token)`);
      console.log(`   PUT  /api/matches/:id/cancel - Cancelar match (requiere token)`);
      console.log(`   PUT  /api/matches/:id/score - Actualizar score (requiere token)`);
      console.log(`   GET  /api/health - Estado del servidor`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
