import { registerJob } from './scheduler'
import { refreshExpiringAccounts } from '../domains/club-mercadopago/club-mercadopago.service'
import { logger } from '../lib/logger'

// Card #74: renews the clubs' Mercado Pago seller tokens (180-day lifetime)
// once they are within 30 days of expiring. Daily is plenty: a failed renewal
// is retried the next day and the owner is emailed (throttled) on failure.
// The refresh token rotates on every renewal; both new tokens are stored
// atomically. Does nothing when MP_APP_ID & co are not configured.
export const refreshMpTokensJob = registerJob('refresh-mp-tokens', '30 3 * * *', async () => {
  const summary = await refreshExpiringAccounts()
  if (summary.checked > 0) {
    logger.info(summary, `[Job:refresh-mp-tokens] checked ${summary.checked}, refreshed ${summary.refreshed}, failed ${summary.failed}`)
  }
})
