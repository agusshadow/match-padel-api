import { achievementsRepository } from './achievements.repository'

export const achievementsService = {
  async getCatalog() {
    return achievementsRepository.findAll()
  },

  async getMyAchievements(userId: string) {
    return achievementsRepository.findEarnedByUser(userId)
  },
}
