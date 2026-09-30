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
  'id, username, first_name, last_name, full_name, avatar_url, elo, xp, level, skill_level, preferred_hand, created_at, role'
const PROFILE_COLUMNS_FULL =
  'id, username, first_name, last_name, full_name, avatar_url, elo, xp, level, phone, skill_level, preferred_hand, onboarding_completed_at, role, created_at, updated_at, is_active'

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

  // Card #60: best-to-worst ELO ranking. Only active players, same public
  // column set as a public profile lookup (no email/phone/etc.).
  async findLeaderboard(page: number, limit: number) {
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS, { count: 'exact' })
      .eq('is_active', true)
      .order('elo', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: data ?? [],
      total: count ?? 0,
    }
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
    // Card #56: total_matches/wins/losses come from the user_stats counter-cache
    // (kept up to date by a DB trigger when a match completes) instead of being
    // recomputed from match_players/matches on every request.
    const [{ data: stats }, { data: userData }] = await Promise.all([
      supabase
        .from('user_stats')
        .select('total_matches, wins, losses')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('users').select('elo').eq('id', userId).single(),
    ])

    const totalMatches = stats?.total_matches ?? 0
    const wins = stats?.wins ?? 0
    const losses = stats?.losses ?? 0
    const elo = userData?.elo ?? 1000
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

    return {
      total_matches: totalMatches,
      wins,
      losses,
      elo,
      win_rate: winRate,
    }
  },

  // Card #54: recent ELO deltas for the profile screen.
  async getEloHistory(userId: string) {
    const { data, error } = await supabase
      .from('elo_history')
      .select('id, match_id, elo_before, elo_after, delta, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data ?? []
  },

  // Card #53: fixed path per user (no extension) with upsert — re-uploading
  // always replaces the same object, so switching formats never leaves an
  // orphaned file behind in the bucket.
  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string }) {
    const path = `${userId}/avatar`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust: the path never changes, so without this the CDN/browser
    // would keep serving the old image after a re-upload.
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

    const { data, error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select(PROFILE_COLUMNS_FULL)
      .single()

    if (error) throw error
    return data
  },
}
