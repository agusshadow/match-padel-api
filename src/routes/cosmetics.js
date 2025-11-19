import express from 'express';
const router = express.Router();
import * as cosmeticController from '../controllers/cosmeticController.js';

// Ruta pública (listar cosméticos disponibles)
router.get('/', cosmeticController.getAvailableCosmetics);

export default router;

