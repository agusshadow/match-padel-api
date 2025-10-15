import express from 'express';
const router = express.Router();

// Importar rutas
import authRoutes from './auth.js';
import userRoutes from './users.js';
import clubRoutes from './clubs.js';
import courtRoutes from './courts.js';
import courtScheduleRoutes from './court-schedules.js';
import courtReservationRoutes from './court-reservations.js';
import matchRoutes from './matches.js';

// Rutas principales
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clubs', clubRoutes);
router.use('/courts', courtRoutes);
router.use('/court-schedules', courtScheduleRoutes);
router.use('/court-reservations', courtReservationRoutes);
router.use('/matches', matchRoutes);

// Ruta de salud
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

// Ruta raíz
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Match Padel API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      clubs: '/api/clubs',
      courts: '/api/courts',
      'court-schedules': '/api/court-schedules',
      'court-reservations': '/api/court-reservations',
      matches: '/api/matches',
      health: '/api/health'
    }
  });
});

export default router;