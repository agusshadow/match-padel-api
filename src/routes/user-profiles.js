import express from 'express';
const router = express.Router();
import * as userProfileController from '../controllers/userProfileController.js';
import { authenticateToken } from '../middleware/auth.js';

// Todas las rutas requieren autenticación
router.get('/profile', authenticateToken, userProfileController.getMyProfile);
router.put('/profile', authenticateToken, userProfileController.updateMyProfile);
router.patch('/profile', authenticateToken, userProfileController.updateMyProfile);

export default router;

