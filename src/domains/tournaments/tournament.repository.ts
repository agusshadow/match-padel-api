import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'
import type {
  MatchRecord,
  TeamRecord,
  TeamStatus,
  TournamentRecord,
  TournamentStatus,
  UserLite,
} from './tournament.core'

// All the Supabase queries of the tournaments domain. Card #77 (club-managed
// tournaments) extends the original file: the public reads now hide drafts and
// unpaid registrations, and the club panel has its own queries.

export const TOURNAMENT_COLUMNS =
  'id, club_id, name, description, format, status, max_teams, entry_fee, prize_pool, rules, start_date, end_date, ' +
  'registration_deadline, category, min_elo, max_elo, started_at, completed_at, cancelled_at, cancel_reason, ' +
  'created_by, created_at, updated_at'

const TEAM_COLUMNS = 'id, tournament_id, name, player1_id, player2_id, seed, status, registered_at, expires_at, paid_at, payment_id'

const MATCH_COLUMNS =
  'id, tournament_id, stage, round, position, team1_id, team2_id, winner_team_id, score_team1, score_team2, status, ' +
  'next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot, team1_players, team2_players, ' +
  'result_by, result_at, scheduled_at, created_at, updated_at'

/** The row as the database returns it (numeric columns are numbers over PostgREST, normalised anyway). */
export interface TournamentRow extends TournamentRecord {
  description: string | null
  category: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_by: string
  created_at: string
  updated_at: string
}

function normalizeTournament(row: Record<string, unknown>): TournamentRow {
  return {
    ...(row as unknown as TournamentRow),
    entry_fee: Number(row.entry_fee ?? 0),
    prize_pool: Number(row.prize_pool ?? 0),
    max_teams: Number(row.max_teams),
    rules: (row.rules as Record<string, unknown> | null) ?? {},
  }
}

export interface CreateTournamentInput {
  club_id: string
  name: string
  description: string | null
  format: TournamentRecord['format']
  max_teams: number
  entry_fee: number
  prize_pool: number
  category: string | null
  min_elo: number | null
  max_elo: number | null
  rules: Record<string, unknown>
  start_date: string
  end_date: string | null
  registration_deadline: string | null
  created_by: string
}

export const tournamentRepository = {
  // ---- Public reads (players) -------------------------------------------------------------------

  async findAll(options: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 0, limit = 20 } = options
    const from = page * limit
    const to = from + limit - 1

    let q = supabase
      .from('tournaments')
      .select(
        `
        id, name, description, format, status, max_teams, entry_fee, prize_pool,
        start_date, end_date, registration_deadline, category, min_elo, max_elo, created_at,
        club:clubs!inner(name, city),
        tournament_teams(id, status)
      `,
        { count: 'exact' },
      )
      .order('start_date', { ascending: true })
      .range(from, to)

    // Card #67: tournaments of clubs that are not approved are not public.
    // Card #77: a draft is only visible to the club's staff (through the panel).
    q = q.eq('club.status', 'approved').eq('club.is_active', true).neq('status', 'draft')
    if (status) q = q.eq('status', status)

    const { data, error, count } = await q
    if (error) throw error
    return {
      items: (data ?? []).map((t) => {
        const row = t as unknown as Record<string, unknown> & { tournament_teams?: Array<{ status: string }> }
        const { tournament_teams, ...rest } = row
        return {
          ...rest,
          // Only paid (confirmed) registrations count.
          teams_count: (tournament_teams ?? []).filter((x) => x.status === 'confirmed').length,
        }
      }),
      total: count ?? 0,
    }
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from('tournaments')
      .select(
        `
        id, name, description, format, status, max_teams, entry_fee, prize_pool, rules,
        start_date, end_date, registration_deadline, category, min_elo, max_elo,
        started_at, completed_at, cancelled_at, cancel_reason,
        created_at, updated_at, created_by,
        club:clubs!inner(id, name, city, address),
        creator:users!tournaments_created_by_fkey(id, username, full_name),
        tournament_teams(
          id, name, seed, status, registered_at,
          player1:users!tournament_teams_player1_id_fkey(id, username, full_name, elo),
          player2:users!tournament_teams_player2_id_fkey(id, username, full_name, elo)
        ),
        tournament_matches(
          id, stage, round, position, status, scheduled_at, score_team1, score_team2,
          team1_players, team2_players,
          next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot,
          team1:tournament_teams!tournament_matches_team1_id_fkey(id, name),
          team2:tournament_teams!tournament_matches_team2_id_fkey(id, name),
          winner_team:tournament_teams!tournament_matches_winner_team_id_fkey(id, name)
        )
      `,
      )
      .eq('id', id)
      .eq('club.status', 'approved') // card #67
      .eq('club.is_active', true)
      .neq('status', 'draft') // card #77
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    const row = data as unknown as Record<string, unknown> & { tournament_teams?: Array<{ status: string }> }
    // Unpaid registrations are not part of the public roster.
    return {
      ...row,
      tournament_teams: (row.tournament_teams ?? []).filter((t) => t.status === 'confirmed'),
    }
  },

  /** A tournament visible to players (not a draft, club approved and active), as the core needs it. */
  async findPublicRecord(id: string): Promise<TournamentRow | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`${TOURNAMENT_COLUMNS}, club:clubs!inner(status, is_active)`)
      .eq('id', id)
      .eq('club.status', 'approved')
      .eq('club.is_active', true)
      .neq('status', 'draft')
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const { club: _club, ...row } = data as unknown as Record<string, unknown>
    return normalizeTournament(row)
  },

  /** Any tournament by id, whatever its visibility (the caller authorizes). */
  async findRecord(id: string): Promise<TournamentRow | null> {
    const { data, error } = await supabase.from('tournaments').select(TOURNAMENT_COLUMNS).eq('id', id).maybeSingle()
    if (error) throw error
    return data ? normalizeTournament(data as unknown as Record<string, unknown>) : null
  },

  // ---- Club panel ---------------------------------------------------------------------------------

  async findClubRecord(clubId: string, id: string): Promise<TournamentRow | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .select(TOURNAMENT_COLUMNS)
      .eq('id', id)
      .eq('club_id', clubId)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeTournament(data as unknown as Record<string, unknown>) : null
  },

  async listForClub(clubId: string, options: { page: number; limit: number; status?: TournamentStatus }) {
    const { from, to } = rangeFor(options.page, options.limit)
    let q = supabase
      .from('tournaments')
      .select(`${TOURNAMENT_COLUMNS}, teams:tournament_teams(status)`, { count: 'exact' })
      .eq('club_id', clubId)
      .order('start_date', { ascending: false })
      .range(from, to)
    if (options.status) q = q.eq('status', options.status)
    const { data, error, count } = await q
    if (error) throw error
    return {
      data: (data ?? []).map((raw) => {
        const row = raw as unknown as Record<string, unknown> & { teams?: Array<{ status: string }> }
        const { teams, ...rest } = row
        const list = teams ?? []
        return {
          tournament: normalizeTournament(rest),
          teams_total: list.length,
          teams_confirmed: list.filter((t) => t.status === 'confirmed').length,
          teams_pending_payment: list.filter((t) => t.status === 'pending_payment').length,
        }
      }),
      total: count ?? 0,
    }
  },

  async create(input: CreateTournamentInput): Promise<TournamentRow> {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({ ...input, status: 'draft' })
      .select(TOURNAMENT_COLUMNS)
      .single()
    if (error) throw error
    return normalizeTournament(data as unknown as Record<string, unknown>)
  },

  async update(id: string, patch: Record<string, unknown>, expected: TournamentStatus[]): Promise<TournamentRow | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', expected)
      .select(TOURNAMENT_COLUMNS)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeTournament(data as unknown as Record<string, unknown>) : null
  },

  /** Status change guarded by the status the caller saw (`expected`); null when it changed meanwhile. */
  async updateStatus(
    id: string,
    patch: {
      status: TournamentStatus
      started_at?: string
      completed_at?: string
      cancelled_at?: string
      cancel_reason?: string | null
    },
    expected?: TournamentStatus[],
  ): Promise<TournamentRow | null> {
    let q = supabase
      .from('tournaments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (expected && expected.length > 0) q = q.in('status', expected)
    const { data, error } = await q.select(TOURNAMENT_COLUMNS).maybeSingle()
    if (error) throw error
    return data ? normalizeTournament(data as unknown as Record<string, unknown>) : null
  },

  async setBracketMeta(id: string, meta: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('tournaments').update({ bracket: meta }).eq('id', id)
    if (error) throw error
  },

  // ---- Teams --------------------------------------------------------------------------------------

  async listTeams(tournamentId: string): Promise<TeamRecord[]> {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select(TEAM_COLUMNS)
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as TeamRecord[]
  },

  async listTeamsWithPlayers(tournamentId: string) {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select(
        `${TEAM_COLUMNS},
         player1:users!tournament_teams_player1_id_fkey(id, username, first_name, last_name, elo),
         player2:users!tournament_teams_player2_id_fkey(id, username, first_name, last_name, elo)`,
      )
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as Array<
      TeamRecord & {
        player1: { id: string; username: string; first_name: string; last_name: string; elo: number } | null
        player2: { id: string; username: string; first_name: string; last_name: string; elo: number } | null
      }
    >
  },

  async findTeamById(id: string): Promise<TeamRecord | null> {
    const { data, error } = await supabase.from('tournament_teams').select(TEAM_COLUMNS).eq('id', id).maybeSingle()
    if (error) throw error
    return (data as unknown as TeamRecord | null) ?? null
  },

  async findTeamOfUser(tournamentId: string, userId: string): Promise<TeamRecord | null> {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select(TEAM_COLUMNS)
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return (data as unknown as TeamRecord | null) ?? null
  },

  async insertTeam(input: {
    tournament_id: string
    player1_id: string
    player2_id: string
    name: string
    status: TeamStatus
    expires_at: string | null
  }): Promise<TeamRecord> {
    const { data, error } = await supabase.from('tournament_teams').insert(input).select(TEAM_COLUMNS).single()
    if (error) throw error
    return data as unknown as TeamRecord
  },

  async updateTeam(
    id: string,
    patch: Partial<Pick<TeamRecord, 'status' | 'expires_at' | 'paid_at' | 'payment_id' | 'seed'>>,
  ): Promise<void> {
    const { error } = await supabase.from('tournament_teams').update(patch).eq('id', id)
    if (error) throw error
  },

  async deleteTeam(id: string): Promise<void> {
    const { error } = await supabase.from('tournament_teams').delete().eq('id', id)
    if (error) throw error
  },

  async countConfirmed(tournamentId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tournament_teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed')
    if (error) throw error
    return count ?? 0
  },

  async countTeams(tournamentId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tournament_teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    if (error) throw error
    return count ?? 0
  },

  async findExpiredPending(now: Date, tournamentId?: string): Promise<TeamRecord[]> {
    let q = supabase
      .from('tournament_teams')
      .select(TEAM_COLUMNS)
      .eq('status', 'pending_payment')
      .lt('expires_at', now.toISOString())
      .limit(200)
    if (tournamentId) q = q.eq('tournament_id', tournamentId)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as unknown as TeamRecord[]
  },

  // ---- Matches ------------------------------------------------------------------------------------

  async listMatches(tournamentId: string): Promise<MatchRecord[]> {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(MATCH_COLUMNS)
      .eq('tournament_id', tournamentId)
      .order('stage')
      .order('round')
      .order('position')
    if (error) throw error
    return (data ?? []) as unknown as MatchRecord[]
  },

  async insertMatches(rows: MatchRecord[]): Promise<void> {
    if (rows.length === 0) return
    const payload = rows.map((r) => ({
      id: r.id,
      tournament_id: r.tournament_id,
      stage: r.stage,
      round: r.round,
      position: r.position,
      team1_id: r.team1_id,
      team2_id: r.team2_id,
      winner_team_id: r.winner_team_id,
      score_team1: r.score_team1,
      score_team2: r.score_team2,
      status: r.status,
      team1_players: r.team1_players,
      team2_players: r.team2_players,
      next_match_id: r.next_match_id,
      next_match_slot: r.next_match_slot,
      loser_next_match_id: r.loser_next_match_id,
      loser_next_match_slot: r.loser_next_match_slot,
    }))
    // One statement: the links point at rows of the same batch, and a foreign key
    // is checked at the end of the statement, so the insert is atomic.
    const { error } = await supabase.from('tournament_matches').insert(payload)
    if (error) throw error
  },

  async updateMatch(id: string, patch: Partial<MatchRecord>): Promise<void> {
    const { error } = await supabase.from('tournament_matches').update(patch).eq('id', id)
    if (error) throw error
  },

  async deleteMatches(tournamentId: string): Promise<void> {
    const { error } = await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId)
    if (error) throw error
  },

  // ---- Users / club -------------------------------------------------------------------------------

  async findUsers(ids: string[]): Promise<UserLite[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, username, elo, is_active')
      .in('id', [...new Set(ids)])
    if (error) throw error
    return (data ?? []).map((u) => ({
      id: u.id as string,
      username: u.username as string,
      elo: Number(u.elo),
      is_active: u.is_active !== false,
    }))
  },

  async findUsersDisplay(ids: string[]) {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name')
      .in('id', [...new Set(ids)])
    if (error) throw error
    return (data ?? []) as Array<{ id: string; username: string; first_name: string; last_name: string }>
  },

  async findClubState(clubId: string): Promise<{ status: string; is_active: boolean } | null> {
    const { data, error } = await supabase.from('clubs').select('status, is_active').eq('id', clubId).maybeSingle()
    if (error) throw error
    return data ? { status: data.status as string, is_active: Boolean(data.is_active) } : null
  },

  // Card #23 (R14), kept: staff of a club (any role) may be told where tournaments are managed now.
  async isClubStaff(clubId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('club_staff')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data !== null
  },
}
