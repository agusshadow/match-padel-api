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
// Configurar CORS para permitir el frontend de Vercel
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // En producción, usar la URL de Vercel
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Rutas
app.use('/api', routes);

// Inicializar base de datos y servidor
const startServer = async () => {
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a PostgreSQL/Supabase');

    // En producción, NO usar sync() - usar solo migraciones
    // En desarrollo, sync puede ser útil para testing rápido
    if (process.env.NODE_ENV !== 'production') {
      // Solo sincronizar en desarrollo (opcional, mejor usar migraciones)
      // await sequelize.sync({ force: false });
      console.log('✅ Base de datos conectada (usar migraciones en producción)');
    } else {
      console.log('✅ Base de datos conectada (producción - usar migraciones)');
    }

    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    console.error('Detalles:', error);
    // No hacer exit inmediatamente, dar más información
    if (error.message.includes('ENETUNREACH') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Verifica que:');
      console.error('   1. DATABASE_URL esté correctamente configurada en Render');
      console.error('   2. La base de datos de Supabase permita conexiones externas');
      console.error('   3. El firewall de Supabase no esté bloqueando la IP de Render');
    }
    process.exit(1);
  }
};

startServer();

export default app;
