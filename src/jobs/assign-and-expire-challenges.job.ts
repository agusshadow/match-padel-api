import { registerJob } from './scheduler'
import { challengesService } from '../domains/challenges/challenges.service'
import { logger } from '../lib/logger'

// Card #62: keeps every active user's rotating challenges current — expires
// rows whose period ended and assigns fresh ones for the current period
// (idempotent, safe to run often; the unique constraint on user_challenges
// makes re-assignment a no-op). Runs more often than a real "exactly at
// midnight" rotation would need, but that precision isn't worth a smarter
// schedule for this catalog's size.
export const assignAndExpireChallengesJob = registerJob(
  'assign-and-expire-challenges',
  '*/15 * * * *',
  async () => {
    await challengesService.assignAndExpire()
    logger.info({}, '[Job:assign-and-expire-challenges] ran')
  },
)
