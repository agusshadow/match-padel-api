import { supabase } from '../../lib/supabase'

export interface CreateTournamentData {
  name: string
  description?: string
  club_id?: string
  format: 'round_robin' | 'elimination'
  max_teams: number
  min_elo?: number
  max_elo?: number
  prize_info?: string
  start_date: string
  end_date?: string
  created_by: string
}

export const tournamentRepository = {
  async findAll(options: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 0, limit = 20 } = options
    const from = page * limit
    const to = from + limit - 1

    let q = supabase
      .from('tournaments')
      .select(
        `
        id, name, description, format, status, max_teams, min_elo, max_elo,
        prize_info, start_date, end_date, created_at,
        club:clubs(name, city),
        creator:users!tournaments_created_by_fkey(username, full_name),
        tournament_teams(id)
      `,
        { count: 'exact' },
      )
      .order('start_date', { ascending: true })
      .range(from, to)

    if (status) q = q.eq('status', status)

    const { data, error, count } = await q
    if (error) throw error
    return {
      items: (data ?? []).map((t: any) => ({
        ...t,
        teams_count: t.tournament_teams?.length ?? 0,
        tournament_teams: undefined,
      })),
      total: count ?? 0,
    }
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from('tournaments')
      .select(
        `
        id, name, description, format, status, max_teams, min_elo, max_elo,
        prize_info, start_date, end_date, created_at, updated_at, created_by,
        club:clubs(id, name, city, address),
        creator:users!tournaments_created_by_fkey(id, username, full_name),
        tournament_teams(
          id, name, status, created_at,
          player1:users!tournament_teams_player1_id_fkey(id, username, full_name, elo),
          player2:users!tournament_teams_player2_id_fkey(id, username, full_name, elo)
        ),
        tournament_matches(
          id, round, status, scheduled_at, score_team1, score_team2,
          team1:tournament_teams!tournament_matches_team1_id_fkey(id, name),
          team2:tournament_teams!tournament_matches_team2_id_fkey(id, name),
          winner_team:tournament_teams!tournament_matches_winner_team_id_fkey(id, name)
        )
      `,
      )
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(data: CreateTournamentData) {
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: data.name,
        description: data.description,
        club_id: data.club_id,
        format: data.format,
        max_teams: data.max_teams,
        min_elo: data.min_elo,
        max_elo: data.max_elo,
        prize_info: data.prize_info,
        start_date: data.start_date,
        end_date: data.end_date,
        created_by: data.created_by,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error
    return tournament
  },

  async registerTeam(
    tournamentId: string,
    player1Id: string,
    player2Id: string,
    name?: string,
  ) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        player1_id: player1Id,
        player2_id: player2Id,
        name: name ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async withdrawTeam(tournamentId: string, userId: string) {
    const { error } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)

    if (error) throw error
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getTeamCount(tournamentId: string) {
    const { count, error } = await supabase
      .from('tournament_teams')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'active')

    if (error) throw error
    return count ?? 0
  },

  async isUserRegistered(tournamentId: string, userId: string) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .maybeSingle()

    if (error) throw error
    return !!data
  },
}
