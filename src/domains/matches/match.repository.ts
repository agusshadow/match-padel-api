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

  async create(data: CreateMatchData, createdBy: string) {
    const lobbyUrl = `${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        type: data.type,
        is_ranked: data.is_ranked,
        club_id: data.club_id ?? null,
        created_by: createdBy,
        lobby_url: lobbyUrl,
        status: 'waiting',
        score_status: 'pending',
      })
      .select()
      .single()

    if (matchError) throw matchError

    // Add creator as team 1
    const { error: playerError } = await supabase
      .from('match_players')
      .insert({
        match_id: match.id,
        user_id: createdBy,
        team: 1,
      })

    if (playerError) throw playerError

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

  async submitScore(matchId: string, score: ScoreData, userId: string) {
    const { data, error } = await supabase
      .from('matches')
      .update({
        score_team1: score.score_team1,
        score_team2: score.score_team2,
        score_status: 'pending',
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async acceptScore(matchId: string, winnerTeam: number) {
    const { data, error } = await supabase
      .from('matches')
      .update({
        score_status: 'accepted',
        winner_team: winnerTeam,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single()

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

  async getUserElo(userId: string): Promise<number> {
    const { data } = await supabase
      .from('users')
      .select('elo')
      .eq('id', userId)
      .single()
    return data?.elo ?? 1000
  },

  async updateUserElo(userId: string, newElo: number) {
    await supabase
      .from('users')
      .update({ elo: newElo, updated_at: new Date().toISOString() })
      .eq('id', userId)
  },

  async insertEloHistory(entry: {
    user_id: string
    match_id: string
    elo_before: number
    elo_after: number
    delta: number
  }) {
    await supabase.from('elo_history').insert(entry)
  },
}
