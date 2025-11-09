import express from 'express';
const router = express.Router();
import * as userProfileController from '../controllers/userProfileController.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadProfilePicture } from '../middleware/upload.js';

// Todas las rutas requieren autenticación
router.get('/profile', authenticateToken, userProfileController.getMyProfile);
router.put('/profile', authenticateToken, userProfileController.updateMyProfile);
router.patch('/profile', authenticateToken, userProfileController.updateMyProfile);
router.post('/profile/picture', authenticateToken, (req, res, next) => {
  uploadProfilePicture(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, userProfileController.uploadProfilePicture);

export default router;

