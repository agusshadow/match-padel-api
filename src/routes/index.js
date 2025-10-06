const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth');

// Rutas principales
router.use('/auth', authRoutes);

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
      health: '/api/health'
    }
  });
});

module.exports = router;