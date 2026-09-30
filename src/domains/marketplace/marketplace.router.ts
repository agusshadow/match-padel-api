import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  getCatalog,
  getMyCosmetics,
  getMyEquipped,
  getMyBalance,
  purchaseCosmetic,
  equipCosmetic,
  purchaseCurrency,
} from './marketplace.controller'

const router = Router()

// GET /api/v1/marketplace/cosmetics — public catalog
router.get('/cosmetics', getCatalog)
// GET /api/v1/marketplace/cosmetics/me — owned cosmetics
router.get('/cosmetics/me', requireAuth, getMyCosmetics)
// GET /api/v1/marketplace/equipped — the 3 equip slots (palette/avatar/emblem)
router.get('/equipped', requireAuth, getMyEquipped)
// GET /api/v1/marketplace/balance — current currency balance
router.get('/balance', requireAuth, getMyBalance)
// POST /api/v1/marketplace/cosmetics/:id/purchase — spend currency on an item
router.post('/cosmetics/:id/purchase', requireAuth, purchaseCosmetic)
// POST /api/v1/marketplace/cosmetics/:id/equip — equip an owned item
router.post('/cosmetics/:id/equip', requireAuth, equipCosmetic)
// POST /api/v1/marketplace/currency/purchase — buy the currency pack with real money
router.post('/currency/purchase', requireAuth, purchaseCurrency)

export default router
