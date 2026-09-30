import { supabase } from '../../lib/supabase'

export const marketplaceRepository = {
  async findCatalog() {
    const { data, error } = await supabase
      .from('cosmetics')
      .select('id, code, name, description, type, image_url, price_currency')
      .eq('is_active', true)
      .order('type', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async findOwnedByUser(userId: string) {
    const { data, error } = await supabase
      .from('user_cosmetics')
      .select('id, acquired_at, cosmetic:cosmetics(id, code, name, description, type, image_url, price_currency)')
      .eq('user_id', userId)
      .order('acquired_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  // Returns just the 3 equipped cosmetic ids — the client already has the
  // full catalog (small, publicly readable) to look up details from, so this
  // avoids a fragile triple self-join on cosmetics via 3 different FKs.
  async findEquipped(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('equipped_palette_cosmetic_id, equipped_avatar_cosmetic_id, equipped_emblem_cosmetic_id')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  },

  async isOwned(userId: string, cosmeticId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_cosmetics')
      .select('id')
      .eq('user_id', userId)
      .eq('cosmetic_id', cosmeticId)
      .maybeSingle()

    if (error) throw error
    return data !== null
  },

  async findCosmeticById(cosmeticId: string) {
    const { data, error } = await supabase
      .from('cosmetics')
      .select('id, type, is_active')
      .eq('id', cosmeticId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async purchase(userId: string, cosmeticId: string) {
    const { data, error } = await supabase.rpc('purchase_cosmetic', {
      p_user_id: userId,
      p_cosmetic_id: cosmeticId,
    })

    if (error) throw error
    return data
  },

  async equip(userId: string, type: 'palette_skin' | 'avatar' | 'emblem', cosmeticId: string) {
    const column =
      type === 'palette_skin'
        ? 'equipped_palette_cosmetic_id'
        : type === 'avatar'
          ? 'equipped_avatar_cosmetic_id'
          : 'equipped_emblem_cosmetic_id'

    const { error } = await supabase
      .from('users')
      .update({ [column]: cosmeticId, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) throw error
  },

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select('points_balance')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data.points_balance
  },
}
