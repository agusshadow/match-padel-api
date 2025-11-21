import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { sequelize } from './config/connection.js';
import routes from './routes/index.js';

import './models/associations.js';

import { startMatchStatusJob } from './jobs/matchStatusJob.js';
import { startChallengeJobs } from './jobs/challengeAssignmentJob.js';

dotenv.config();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', routes);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a PostgreSQL/Supabase');

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Base de datos conectada (usar migraciones en producción)');
    } else {
      console.log('✅ Base de datos conectada (producción - usar migraciones)');
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor en puerto ${PORT}`);
    });

    startMatchStatusJob();
    
    await startChallengeJobs();
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    console.error('Detalles:', error);
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
