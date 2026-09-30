import { registerJob } from './scheduler'
import { matchService } from '../domains/matches/match.service'
import { logger } from '../lib/logger'

// Card #57: a match tied to a real court reservation that never reached 4
// confirmed players by the time the court slot started is never happening —
// free the court and refund whoever already paid their share.
export const autoCancelUnfilledMatchesJob = registerJob(
  'auto-cancel-unfilled-matches',
  '*/5 * * * *',
  async () => {
    const cancelledIds = await matchService.autoCancelUnfilledMatches()
    if (cancelledIds.length > 0) {
      logger.info(
        { cancelledIds },
        `[Job:auto-cancel-unfilled-matches] cancelled ${cancelledIds.length} match(es)`,
      )
    }
  },
)
