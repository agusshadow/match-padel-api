import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { sequelize } from './config/connection.js';
import routes from './routes/index.js';

// Importar y configurar asociaciones entre modelos
import './models/associations.js';

dotenv.config();

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
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;
