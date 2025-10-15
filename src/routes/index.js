const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth');
const clubRoutes = require('./clubs');
const courtRoutes = require('./courts');
const matchRoutes = require('./matches');

// Rutas principales
router.use('/auth', authRoutes);
router.use('/clubs', clubRoutes);
router.use('/courts', courtRoutes);
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
      clubs: '/api/clubs',
      courts: '/api/courts',
      matches: '/api/matches',
      health: '/api/health'
    }
  });
});

module.exports = router;