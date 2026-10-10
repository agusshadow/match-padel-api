import { logger } from '../../lib/logger'
import { createMpOAuthClient, getMpOAuthConfig } from '../../lib/mp-oauth'
import { recordAudit } from '../audit/audit.service'
import { getMailConfig, notifyMpConnectionProblem } from '../mail/mail.service'
import { createMercadoPagoCore } from './club-mercadopago.core'
import * as repository from './club-mercadopago.repository'

// Real wiring of the core (see club-mercadopago.core.ts for the logic).
const core = createMercadoPagoCore({
  repo: repository,
  getConfig: () => getMpOAuthConfig(),
  createClient: (config) => createMpOAuthClient(config),
  audit: recordAudit,
  notify: notifyMpConnectionProblem,
  panelUrl: () => getMailConfig().clubPanelUrl,
  now: () => new Date(),
  logger,
})

export const startConnect = core.startConnect
export const completeCallback = core.completeCallback
export const getStatus = core.getStatus
export const disconnect = core.disconnect
export const refreshAccount = core.refreshAccount
export const refreshExpiringAccounts = core.refreshExpiringAccounts

/**
 * Token provider for the charging flows (card #75). Decrypts the club's seller
 * access token, renews it on demand when it ends within minutes (single-flight
 * per club) and throws `AppError` 409 `MP_ACCOUNT_NOT_CONNECTED` or
 * `MP_ACCOUNT_EXPIRED` (also when revoked, `details.reason`).
 */
export const getClubAccessToken = core.getClubAccessToken
