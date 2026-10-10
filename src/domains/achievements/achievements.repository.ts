import { supabase } from '../../lib/supabase'

// Card #54: activates the dormant `achievements`/`user_achievements` tables —
// no writes happen here (they're awarded inside accept_match_score, see
// docs/schema.sql), this domain is read-only. The catalog is administered
// from /platform/catalogs (card #78).
export const achievementsRepository = {
  async findAll() {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, code, name, description, icon, points')
      .eq('is_active', true) // card #78: deactivated achievements are not offered; earned ones still show in findEarnedByUser
      .order('points', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async findEarnedByUser(userId: string) {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('earned_at, achievement:achievements(id, code, name, description, icon, points)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
}
