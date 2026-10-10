import { Router } from 'express'
import { requireClubRole } from '../../middleware/access.middleware'
import { mpConnectLimiter, mpCallbackLimiter } from '../../middleware/rate-limit'
import * as controller from './club-mercadopago.controller'

// Mounted by the club-admin router at /api/v1/club-admin/:clubId/mercadopago
// (requireAuth + loadAccess already ran there). OWNER ONLY, on every route: the
// Administrador and Recepcion get 403. A platform superadmin passes, as everywhere.
const router = Router({ mergeParams: true })
const ownerOnly = requireClubRole(['owner'])

router.get('/', ownerOnly, controller.getStatus)
router.post('/connect', mpConnectLimiter, ownerOnly, controller.connect)
router.delete('/', ownerOnly, controller.disconnect)

export default router

// Public, mounted at /api/v1/mercadopago. No auth: the request is Mercado Pago
// redirecting the owner's browser back. Protected by the single-use `state`.
export const mercadoPagoPublicRouter = Router()

mercadoPagoPublicRouter.get('/oauth/callback', mpCallbackLimiter, controller.oauthCallback)
