import express from 'express';
const router = express.Router();
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rutas protegidas
router.get('/profile', authenticateToken, authController.getProfile);

export default router;