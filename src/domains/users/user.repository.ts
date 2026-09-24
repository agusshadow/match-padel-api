import { supabase } from '../../lib/supabase'

export interface UpdateUserData {
  full_name?: string
  phone?: string
  avatar_url?: string
}

export const userRepository = {
  async findById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, elo, created_at, role')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async findByIdFull(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, elo, phone, role, created_at, updated_at, is_active')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async findByUsername(username: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, elo, created_at, role')
      .eq('username', username)
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updateData: UpdateUserData) {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, username, full_name, avatar_url, elo, phone, role, created_at, updated_at')
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
