import { registerJob } from './scheduler'
import { expireUnpaidReservations } from '../domains/reservations/reservation.service'
import { logger } from '../lib/logger'

// Card #13/#50: frees up courts blocked by reservations nobody paid for.
// Runs every 5 minutes — the same cadence legacy used for its match-status job.
export const expireReservationsJob = registerJob(
  'expire-unpaid-reservations',
  '*/5 * * * *',
  async () => {
    const cancelledIds = await expireUnpaidReservations()
    if (cancelledIds.length > 0) {
      logger.info({ cancelledIds }, `[Job:expire-unpaid-reservations] cancelled ${cancelledIds.length} reservation(s)`)
    }
  },
)
