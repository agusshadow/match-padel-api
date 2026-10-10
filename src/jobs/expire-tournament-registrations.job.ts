import { registerJob } from './scheduler'
import { tournamentService } from '../domains/tournaments/tournament.service'
import { logger } from '../lib/logger'

// Card #77: releases the places held by tournament registrations nobody paid
// within REGISTRATION_TTL_MINUTES (30). Same cadence and pattern as
// expire-unpaid-reservations. A late approved payment of a released registration
// is refunded in full by the payment confirmation flow.
export const expireTournamentRegistrationsJob = registerJob(
  'expire-tournament-registrations',
  '*/5 * * * *',
  async () => {
    const released = await tournamentService.expirePendingRegistrations()
    if (released > 0) {
      logger.info({ released }, `[Job:expire-tournament-registrations] released ${released} registration(s)`)
    }
  },
)
