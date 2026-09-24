import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { createPreference, webhook } from './payment.controller'

const router = Router()

// POST /api/v1/payments/preference — create MP preference for a reservation
router.post('/preference', requireAuth, createPreference)

// POST /api/v1/payments/webhook — MercadoPago IPN (no auth)
router.post('/webhook', webhook)

export default router
