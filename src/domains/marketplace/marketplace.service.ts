import { marketplaceRepository } from './marketplace.repository'
import { NotFoundError, AppError } from '../../types/errors'

export const marketplaceService = {
  async getCatalog() {
    return marketplaceRepository.findCatalog()
  },

  async getMyCosmetics(userId: string) {
    return marketplaceRepository.findOwnedByUser(userId)
  },

  async getMyEquipped(userId: string) {
    return marketplaceRepository.findEquipped(userId)
  },

  async getMyBalance(userId: string) {
    return marketplaceRepository.getBalance(userId)
  },

  async purchaseCosmetic(userId: string, cosmeticId: string) {
    try {
      return await marketplaceRepository.purchase(userId, cosmeticId)
    } catch (err) {
      const message = (err as Error).message ?? ''
      if (message.includes('COSMETIC_NOT_FOUND')) throw new NotFoundError('Cosmetic')
      if (message.includes('ALREADY_OWNED')) throw new AppError('You already own this item', 409, 'ALREADY_OWNED')
      if (message.includes('INSUFFICIENT_BALANCE')) {
        throw new AppError('Not enough currency', 400, 'INSUFFICIENT_BALANCE')
      }
      throw err
    }
  },

  async equipCosmetic(userId: string, cosmeticId: string) {
    const cosmetic = await marketplaceRepository.findCosmeticById(cosmeticId)
    if (!cosmetic || !cosmetic.is_active) {
      throw new NotFoundError('Cosmetic')
    }

    const owned = await marketplaceRepository.isOwned(userId, cosmeticId)
    if (!owned) {
      throw new AppError('You must own this item before equipping it', 403, 'NOT_OWNED')
    }

    await marketplaceRepository.equip(userId, cosmetic.type, cosmeticId)
  },
}
