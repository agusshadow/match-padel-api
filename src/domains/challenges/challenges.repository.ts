import { supabase } from '../../lib/supabase'

// Card #62: catalog reads and per-user progress reads are the only queries
// here — assignment/expiration and progress increments happen inside
// Postgres functions (assign_and_expire_challenges, called by the scheduled
// job; increment_challenge_progress, called from accept_match_score).
export const challengesRepository = {
  async findCatalog() {
    const { data, error } = await supabase
      .from('challenges')
      .select('id, code, name, description, cadence, action_type, target_count, reward_xp, reward_currency')
      .eq('is_active', true)
      .order('cadence', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async findMyChallenges(userId: string) {
    const { data, error } = await supabase
      .from('user_challenges')
      .select(
        `
        id, progress, status, period_start, period_end, completed_at,
        challenge:challenges(id, code, name, description, cadence, action_type, target_count, reward_xp, reward_currency)
      `,
      )
      .eq('user_id', userId)
      .in('status', ['active', 'completed'])
      .order('period_start', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async runAssignAndExpire(): Promise<void> {
    const { error } = await supabase.rpc('assign_and_expire_challenges')
    if (error) throw error
  },
}
