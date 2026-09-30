import { supabase } from '../../lib/supabase'

export interface FindByUserOptions {
  status?: string
  type?: string
  page?: number
}

export interface CreateMatchData {
  type: 'friendly' | 'ranked' | 'tournament'
  is_ranked: boolean
  club_id?: string
  reservation_id: string
}

export interface ScoreData {
  score_team1: number[]
  score_team2: number[]
}

export const matchRepository = {
  async findByUser(userId: string, options: FindByUserOptions = {}) {
    const { status, type, page = 1 } = options
    const limit = 20
    const offset = (page - 1) * limit

    // Get match IDs where user is a player
    let query = supabase
      .from('match_players')
      .select(`
        match_id,
        team,
        matches!inner (
          id,
          type,
          status,
          is_ranked,
          lobby_url,
          score_team1,
          score_team2,
          score_status,
          winner_team,
          created_at,
          updated_at,
          created_by,
          match_players (
            id,
            team,
            user_id,
            joined_at,
            users (
              id,
              username,
              full_name,
              avatar_url,
              elo
            )
          )
        )
      `)
      .eq('user_id', userId)
      .order('match_id', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) throw error

    let matches = (data ?? []).map((row: any) => row.matches)

    if (status) {
      matches = matches.filter((m: any) => m.status === status)
    }
    if (type) {
      matches = matches.filter((m: any) => m.type === type)
    }

    return matches
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          id,
          team,
          user_id,
          joined_at,
          users (
            id,
            username,
            full_name,
            avatar_url,
            elo
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async findByLobbyUrl(lobbyUrl: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          id,
          team,
          user_id,
          joined_at,
          users (
            id,
            username,
            full_name,
            avatar_url,
            elo
          )
        )
      `)
      .eq('lobby_url', lobbyUrl)
      .single()

    if (error) throw error
    return data
  },

  // The creator, like every other player, only becomes a match_players row once
  // their share of the court is actually paid (see payment.service.ts's webhook
  // handling) — so creating a match no longer inserts a player row here.
  async create(data: CreateMatchData, createdBy: string) {
    const lobbyUrl = `${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        type: data.type,
        is_ranked: data.is_ranked,
        club_id: data.club_id ?? null,
        reservation_id: data.reservation_id,
        created_by: createdBy,
        lobby_url: lobbyUrl,
        status: 'waiting',
        score_status: 'pending',
      })
      .select()
      .single()

    if (matchError) throw matchError

    return match
  },

  async join(matchId: string, userId: string, team: number) {
    const { data, error } = await supabase
      .from('match_players')
      .insert({
        match_id: matchId,
        user_id: userId,
        team,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateStatus(matchId: string, status: string) {
    const { error } = await supabase
      .from('matches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', matchId)

    if (error) throw error
  },

  // Card #58: each team submits their own claimed result independently — no
  // more "one team submits, the other accepts/rejects" (a losing team could
  // just reject forever). The Postgres function compares both teams' drafts
  // and, on an exact match, atomically confirms the score (ELO/stats/
  // achievements via accept_match_score); on a mismatch it clears both
  // drafts and counts the attempt, going permanently 'disputed' at 3.
  async submitScoreDraft(matchId: string, team: number, draft: ScoreData) {
    const { data, error } = await supabase.rpc('submit_match_score_draft', {
      p_match_id: matchId,
      p_team: team,
      p_draft: draft,
    })

    if (error) throw error
    return data
  },

  async cancel(matchId: string) {
    const { data, error } = await supabase
      .from('matches')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getPlayerTeam(matchId: string, userId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('match_players')
      .select('team')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .single()

    if (error) return null
    return data?.team ?? null
  },

  async getPlayers(matchId: string) {
    const { data, error } = await supabase
      .from('match_players')
      .select(`
        *,
        users (id, username, full_name, avatar_url, elo)
      `)
      .eq('match_id', matchId)

    if (error) throw error
    return data ?? []
  },

  async isPlayer(matchId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data !== null
  },

  async countPlayers(matchId: string): Promise<number> {
    const { count, error } = await supabase
      .from('match_players')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId)

    if (error) throw error
    return count ?? 0
  },

  async removePlayer(matchId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Used by the auto-cancel job: matches whose court time already started (or
  // passed) but never reached 4 confirmed players — nobody is coming, free the
  // court and refund whoever already paid their share.
  async findUnfilledPastMatches(): Promise<Array<{ id: string; reservation_id: string }>> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('matches')
      .select('id, reservation_id, court_reservations!inner(start_time)')
      .eq('status', 'waiting')
      .not('reservation_id', 'is', null)
      .lt('court_reservations.start_time', now)

    if (error) throw error
    return (data ?? []).map((m: any) => ({ id: m.id, reservation_id: m.reservation_id }))
  },

}
