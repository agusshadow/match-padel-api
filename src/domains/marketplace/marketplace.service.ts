import { marketplaceRepository } from './marketplace.repository'
import { NotFoundError, AppError } from '../../types/errors'

export const marketplaceService = {
  async getCatalog() {
    return marketplaceRepository.findCatalog()
  },

  async getMyCosmetics(userId: string) {
    return marketplaceRepository.findOwnedByUser(userId)
  },

  // The 3 equipped ids (unchanged) plus the cosmetic itself per slot (card #78):
  // an equipped item that was later deactivated is no longer in the public
  // catalog, so the client cannot look it up there.
  async getMyEquipped(userId: string) {
    const equipped = await marketplaceRepository.findEquipped(userId)
    const ids = [
      equipped.equipped_palette_cosmetic_id,
      equipped.equipped_avatar_cosmetic_id,
      equipped.equipped_emblem_cosmetic_id,
    ].filter((id): id is string => Boolean(id))
    const cosmetics = await marketplaceRepository.findCosmeticsByIds(ids)
    const byId = new Map(cosmetics.map((c) => [c.id, c]))
    return {
      ...equipped,
      palette: byId.get(equipped.equipped_palette_cosmetic_id ?? '') ?? null,
      avatar: byId.get(equipped.equipped_avatar_cosmetic_id ?? '') ?? null,
      emblem: byId.get(equipped.equipped_emblem_cosmetic_id ?? '') ?? null,
    }
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
      if (message.includes('COSMETIC_INACTIVE')) {
        throw new AppError('This item is no longer available in the store', 409, 'COSMETIC_INACTIVE')
      }
      if (message.includes('ALREADY_OWNED')) throw new AppError('You already own this item', 409, 'ALREADY_OWNED')
      if (message.includes('INSUFFICIENT_BALANCE')) {
        throw new AppError('Not enough currency', 400, 'INSUFFICIENT_BALANCE')
      }
      throw err
    }
  },

  async equipCosmetic(userId: string, cosmeticId: string) {
    const cosmetic = await marketplaceRepository.findCosmeticById(cosmeticId)
    // Card #78: ownership is what matters. A cosmetic deactivated after the
    // purchase can still be (re-)equipped by its owners.
    if (!cosmetic) {
      throw new NotFoundError('Cosmetic')
    }

    const owned = await marketplaceRepository.isOwned(userId, cosmeticId)
    if (!owned) {
      throw new AppError('You must own this item before equipping it', 403, 'NOT_OWNED')
    }

    await marketplaceRepository.equip(userId, cosmetic.type, cosmeticId)
  },
}
