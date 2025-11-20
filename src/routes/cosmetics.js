import express from 'express';
const router = express.Router();
import * as cosmeticController from '../controllers/cosmeticController.js';
import { authenticateToken } from '../middleware/auth.js';

// Ruta pública (listar todos los cosméticos)
router.get('/', cosmeticController.getAvailableCosmetics);

// Ruta protegida (equipar cosmético)
router.post('/:id/equip', authenticateToken, cosmeticController.equipCosmetic);

export default router;

