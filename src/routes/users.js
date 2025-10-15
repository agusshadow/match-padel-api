const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Rutas públicas
router.post('/', userController.createUser); // Registro de usuarios

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticateToken, userController.getUserProfile);
router.put('/change-password', authenticateToken, userController.changeMyPassword);

// Rutas protegidas (requieren autenticación y rol admin)
router.get('/', authenticateToken, requireAdmin, userController.getAllUsers);
router.get('/:id', authenticateToken, requireAdmin, userController.getUserById);
router.put('/:id', authenticateToken, requireAdmin, userController.updateUser);
router.delete('/:id', authenticateToken, requireAdmin, userController.deleteUser);
router.put('/:id/change-password', authenticateToken, requireAdmin, userController.changePassword);

module.exports = router;
