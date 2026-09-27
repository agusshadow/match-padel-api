import { supabase } from '../../lib/supabase'
import { ConflictError } from '../../types/errors'

export interface UpdateUserData {
  first_name?: string
  last_name?: string
  username?: string
  phone?: string
  avatar_url?: string
  skill_level?: 'beginner' | 'intermediate' | 'advanced'
  preferred_hand?: 'drive' | 'backhand'
  onboarding_completed_at?: string
}

const PROFILE_COLUMNS =
  'id, username, first_name, last_name, full_name, avatar_url, elo, skill_level, preferred_hand, created_at, role'
const PROFILE_COLUMNS_FULL =
  'id, username, first_name, last_name, full_name, avatar_url, elo, phone, skill_level, preferred_hand, onboarding_completed_at, role, created_at, updated_at, is_active'

export const userRepository = {
  async findById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async findByIdFull(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS_FULL)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async findByUsername(username: string) {
    const { data, error } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('username', username)
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updateData: UpdateUserData) {
    if (updateData.username) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', updateData.username)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        throw new ConflictError('Username already taken')
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(PROFILE_COLUMNS_FULL)
      .single()

    if (error) throw error
    return data
  },

  async getStats(userId: string) {
    // Total matches
    const { count: totalMatches } = await supabase
      .from('match_players')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Wins: matches where this user's team is the winner
    const { data: playerData } = await supabase
      .from('match_players')
      .select('team, match_id, matches!inner(winner_team, status, is_ranked)')
      .eq('user_id', userId)
      .eq('matches.status', 'completed')

    const completedMatches = playerData ?? []
    const wins = completedMatches.filter(
      (p: any) => p.team === p.matches?.winner_team
    ).length
    const losses = completedMatches.length - wins

    // ELO
    const { data: userData } = await supabase
      .from('users')
      .select('elo')
      .eq('id', userId)
      .single()

    const elo = userData?.elo ?? 1000
    const total = totalMatches ?? 0
    const winRate = total > 0 ? Math.round((wins / completedMatches.length) * 100) : 0

    return {
      total_matches: total,
      wins,
      losses,
      elo,
      win_rate: winRate,
    }
  },
}
