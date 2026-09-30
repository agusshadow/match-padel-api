import { challengesRepository } from './challenges.repository'

export const challengesService = {
  async getCatalog() {
    return challengesRepository.findCatalog()
  },

  async getMyChallenges(userId: string) {
    return challengesRepository.findMyChallenges(userId)
  },

  // Called by the scheduled job (src/jobs/assign-and-expire-challenges.job.ts).
  async assignAndExpire(): Promise<void> {
    return challengesRepository.runAssignAndExpire()
  },
}
