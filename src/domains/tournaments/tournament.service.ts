import { randomUUID } from 'crypto'
import { AppError, NotFoundError } from '../../types/errors'
import { logger } from '../../lib/logger'
import { buildMeta } from '../../lib/pagination'
import { notifications } from '../notifications/notification.service'
import { recordAudit } from '../audit/audit.service'
import * as paymentRepository from '../payments/payment.repository'
import {
  assertClubCanCharge,
  createTournamentRegistrationPayment,
  refundAllTournamentPayments,
  refundTournamentTeamByPolicy,
} from '../payments/payment.service'
import { tournamentRepository, type TournamentRow } from './tournament.repository'
import {
  computeStandings,
  createLifecycleCore,
  createRegistrationCore,
  createResultCore,
  type MatchRecord,
  type TeamRecord,
  type TournamentNotifier,
  type TournamentStandings,
  type TournamentStatus,
} from './tournament.core'
import { outcomeOf } from './bracket.core'
import { checkRanges, type CreateTournamentInput, type UpdateTournamentInput } from './tournament.validator'
import type { StartResult } from './tournament.core'

// ---- Wiring of the cores ---------------------------------------------------------------------

const notifier: TournamentNotifier = {
  async registrationConfirmed(userIds, input) {
    await notifications.tournamentRegistrationConfirmed(userIds, input)
  },
  async partnerRegistered(partnerId, tournamentId, teamName) {
    await notifications.tournamentTeamRegistered(partnerId, tournamentId, teamName)
  },
  async cancelled(userIds, input) {
    await notifications.tournamentCancelled(userIds, input)
  },
  async started(userIds, input) {
    await notifications.tournamentStarted(userIds, input)
  },
  async result(userIds, input) {
    await notifications.tournamentResult(userIds, input)
  },
}

const onError = (message: string, context: Record<string, unknown>) => logger.error(context, message)

const registration = createRegistrationCore({
  now: () => new Date(),
  findPublicTournament: (id) => tournamentRepository.findPublicRecord(id),
  findUsers: (ids) => tournamentRepository.findUsers(ids),
  findTeamOfUser: (tournamentId, userId) => tournamentRepository.findTeamOfUser(tournamentId, userId),
  countConfirmed: (id) => tournamentRepository.countConfirmed(id),
  insertTeam: (input) => tournamentRepository.insertTeam(input),
  updateTeam: (id, patch) => tournamentRepository.updateTeam(id, patch),
  deleteTeam: (id) => tournamentRepository.deleteTeam(id),
  findExpiredPending: (now, tournamentId) => tournamentRepository.findExpiredPending(now, tournamentId),
  assertClubCanCharge: (clubId, amount) => assertClubCanCharge(clubId, amount),
  createRegistrationPayment: (input) => createTournamentRegistrationPayment(input),
  findRefundablePayments: (teamId) => paymentRepository.findRefundableTournamentPayments({ teamId }),
  refundByPolicy: (input) => refundTournamentTeamByPolicy(input),
  cancelPendingPayments: (teamIds) => paymentRepository.cancelPendingTournamentPayments({ teamIds }),
  notifier,
  onError,
})

const lifecycle = createLifecycleCore({
  now: () => new Date(),
  newId: () => randomUUID(),
  findClubState: (clubId) => tournamentRepository.findClubState(clubId),
  assertClubCanCharge: (clubId, amount) => assertClubCanCharge(clubId, amount),
  setStatus: (id, patch, expected) => tournamentRepository.updateStatus(id, patch, expected),
  listTeams: (id) => tournamentRepository.listTeams(id),
  updateTeam: (id, patch) => tournamentRepository.updateTeam(id, patch),
  deleteTeam: (id) => tournamentRepository.deleteTeam(id),
  findUsers: (ids) => tournamentRepository.findUsers(ids),
  expirePending: (id) => registration.expirePending(id),
  cancelPendingPayments: (teamIds) => paymentRepository.cancelPendingTournamentPayments({ teamIds }),
  refundAllPayments: async (tournamentId) => {
    const t = await tournamentRepository.findRecord(tournamentId)
    return refundAllTournamentPayments(tournamentId, t?.club_id ?? '')
  },
  insertMatches: (rows) => tournamentRepository.insertMatches(rows),
  updateMatch: (id, patch) => tournamentRepository.updateMatch(id, patch),
  deleteMatches: (id) => tournamentRepository.deleteMatches(id),
  setBracketMeta: (id, meta) => tournamentRepository.setBracketMeta(id, meta),
  notifier,
  onError,
})

const results = createResultCore({
  now: () => new Date(),
  listMatches: (id) => tournamentRepository.listMatches(id),
  updateMatch: (id, patch) => tournamentRepository.updateMatch(id, patch),
  listTeams: (id) => tournamentRepository.listTeams(id),
  setStatus: (id, patch, expected) => tournamentRepository.updateStatus(id, patch, expected),
  notifier,
  onError,
})

// ---- Serialization ------------------------------------------------------------------------------

/** The tournament as the club panel and the API contract describe it. */
export function serializeTournament(row: TournamentRow) {
  return {
    id: row.id,
    club_id: row.club_id,
    name: row.name,
    description: row.description,
    format: row.format,
    status: row.status,
    max_teams: row.max_teams,
    max_players: row.format === 'americano' ? row.max_teams * 2 : null,
    category: row.category,
    min_elo: row.min_elo,
    max_elo: row.max_elo,
    entry_fee: row.entry_fee,
    prize_pool: row.prize_pool,
    rules: row.rules,
    start_date: row.start_date,
    end_date: row.end_date,
    registration_deadline: row.registration_deadline,
    started_at: row.started_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    cancel_reason: row.cancel_reason,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

type PlayerView = { id: string; username: string; first_name: string; last_name: string }

function matchView(
  m: MatchRecord,
  teamNames: Map<string, string>,
  players: Map<string, PlayerView>,
  format: TournamentRow['format'],
) {
  const pair = (ids: string[] | null) =>
    ids ? ids.map((id) => players.get(id) ?? { id, username: '', first_name: '', last_name: '' }) : null
  let winner: 1 | 2 | null = null
  if (m.status === 'completed') {
    if (format === 'americano') {
      winner = outcomeOf({ score_team1: m.score_team1 ?? [], score_team2: m.score_team2 ?? [] }).winner
    } else if (m.winner_team_id) {
      winner = m.winner_team_id === m.team1_id ? 1 : 2
    }
  }
  return {
    id: m.id,
    stage: m.stage,
    round: m.round,
    position: m.position,
    status: m.status,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    team1: m.team1_id ? { id: m.team1_id, name: teamNames.get(m.team1_id) ?? null } : null,
    team2: m.team2_id ? { id: m.team2_id, name: teamNames.get(m.team2_id) ?? null } : null,
    team1_players: pair(m.team1_players),
    team2_players: pair(m.team2_players),
    winner_team_id: m.winner_team_id,
    winner,
    score_team1: m.score_team1,
    score_team2: m.score_team2,
    next_match_id: m.next_match_id,
    next_match_slot: m.next_match_slot,
    loser_next_match_id: m.loser_next_match_id,
    loser_next_match_slot: m.loser_next_match_slot,
    scheduled_at: m.scheduled_at ?? null,
    result_at: m.result_at,
  }
}

async function loadMatchContext(tournamentId: string) {
  const [teams, matches] = await Promise.all([
    tournamentRepository.listTeamsWithPlayers(tournamentId),
    tournamentRepository.listMatches(tournamentId),
  ])
  const teamNames = new Map(teams.map((t) => [t.id, t.name]))
  const players = new Map<string, PlayerView>()
  for (const t of teams) {
    for (const p of [t.player1, t.player2]) {
      if (p) players.set(p.id, { id: p.id, username: p.username, first_name: p.first_name, last_name: p.last_name })
    }
  }
  return { teams, matches, teamNames, players }
}

function standingsView(
  standings: TournamentStandings,
  teamNames: Map<string, string>,
  players: Map<string, PlayerView>,
) {
  if (standings.type === 'americano') {
    return {
      type: standings.type,
      rows: standings.rows.map((r) => {
        const row = r as { player_id: string }
        const p = players.get(row.player_id)
        return { ...r, player: p ?? { id: row.player_id, username: '', first_name: '', last_name: '' } }
      }),
    }
  }
  return {
    type: standings.type,
    rows: standings.rows.map((r) => {
      const row = r as { team_id: string }
      return { ...r, team_name: teamNames.get(row.team_id) ?? null }
    }),
  }
}

// ---- Public (players) ----------------------------------------------------------------------------

export const tournamentService = {
  async listTournaments(options: { status?: string; page?: number; limit?: number } = {}) {
    return tournamentRepository.findAll(options)
  },

  async getTournamentById(id: string) {
    const tournament = await tournamentRepository.findById(id)
    if (!tournament) throw new NotFoundError('Tournament')
    return tournament
  },

  /**
   * Card #77: tournaments are created and managed by clubs from the panel
   * (`POST /club-admin/:clubId/tournaments`). The player-side route is closed:
   * 403 for anyone who is not staff of the club, 410 with the new endpoint for staff.
   */
  async rejectPlayerSideManagement(
    userId: string,
    target: { clubId?: string; tournamentId?: string },
  ): Promise<never> {
    let clubId = target.clubId
    if (!clubId && target.tournamentId) {
      clubId = (await tournamentRepository.findRecord(target.tournamentId))?.club_id
    }
    const isStaff = clubId ? await tournamentRepository.isClubStaff(clubId, userId) : false
    if (isStaff) {
      throw new AppError(
        'Tournaments are managed from the club panel',
        410,
        'TOURNAMENT_MANAGEMENT_MOVED',
        { endpoint: 'POST /api/v1/club-admin/:clubId/tournaments' },
      )
    }
    throw new AppError(
      'Tournaments are created and managed by clubs',
      403,
      'TOURNAMENTS_MANAGED_BY_CLUBS',
    )
  },

  async registerTeam(tournamentId: string, userId: string, partnerId: string, teamName?: string) {
    const result = await registration.registerTeam({ tournamentId, userId, partnerId, teamName })
    return { ...result.team, payment_required: result.payment_required, payment: result.payment }
  },

  async withdrawTeam(tournamentId: string, userId: string) {
    const tournament = await tournamentRepository.findRecord(tournamentId)
    const { refund } = await registration.withdraw({ tournament, userId })
    return { success: true, refund }
  },

  /** Job: releases the unpaid registrations whose time ran out. */
  async expirePendingRegistrations(): Promise<number> {
    return registration.expirePending()
  },

  // ---- Club panel ------------------------------------------------------------------------------

  async listClubTournaments(
    clubId: string,
    options: { page: number; limit: number; status?: TournamentStatus },
  ) {
    const { data, total } = await tournamentRepository.listForClub(clubId, options)
    return {
      data: data.map((r) => ({
        ...serializeTournament(r.tournament),
        // `teams` keeps the shape of the previous endpoint (a count of every registration).
        teams: [{ count: r.teams_total }],
        teams_confirmed: r.teams_confirmed,
        teams_pending_payment: r.teams_pending_payment,
      })),
      meta: buildMeta(options.page, options.limit, total),
    }
  },

  async createClubTournament(clubId: string, actorId: string, input: CreateTournamentInput) {
    const club = await tournamentRepository.findClubState(clubId)
    if (!club) throw new NotFoundError('Club')
    if (club.status !== 'approved' || !club.is_active) {
      throw new AppError('The club must be approved and active to create tournaments', 409, 'CLUB_NOT_APPROVED')
    }
    if (new Date(input.start_date).getTime() <= Date.now()) {
      throw new AppError('start_date must be in the future', 400, 'VALIDATION_ERROR')
    }
    const maxTeams = input.format === 'americano' ? (input.max_players as number) / 2 : (input.max_teams as number)
    const row = await tournamentRepository.create({
      club_id: clubId,
      name: input.name,
      description: input.description ?? null,
      format: input.format,
      max_teams: maxTeams,
      entry_fee: input.entry_fee,
      prize_pool: input.prize_pool,
      category: input.category ?? null,
      min_elo: input.min_elo ?? null,
      max_elo: input.max_elo ?? null,
      rules: input.rules ?? {},
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      registration_deadline: input.registration_deadline ?? null,
      created_by: actorId,
    })
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.created',
      entity: 'tournament',
      entityId: row.id,
      metadata: { name: row.name, format: row.format, max_teams: row.max_teams, entry_fee: row.entry_fee },
    })
    return serializeTournament(row)
  },

  async getClubTournament(clubId: string, id: string) {
    const tournament = await tournamentRepository.findClubRecord(clubId, id)
    if (!tournament) throw new NotFoundError('Tournament')

    const [ctx, payments] = await Promise.all([loadMatchContext(id), paymentRepository.listTournamentPayments(id)])
    const paymentsByTeam = new Map<string, (typeof payments)[number]>()
    for (const p of payments) {
      if (p.tournament_team_id && !paymentsByTeam.has(p.tournament_team_id)) paymentsByTeam.set(p.tournament_team_id, p)
    }
    const teamRecords: TeamRecord[] = ctx.teams
    const standings = standingsView(
      computeStandings(tournament, teamRecords.filter((t) => t.status === 'confirmed'), ctx.matches),
      ctx.teamNames,
      ctx.players,
    )

    const approved = payments.filter((p) => p.status === 'approved')
    return {
      ...serializeTournament(tournament),
      counts: {
        teams_confirmed: ctx.teams.filter((t) => t.status === 'confirmed').length,
        teams_pending_payment: ctx.teams.filter((t) => t.status === 'pending_payment').length,
        matches_total: ctx.matches.length,
        matches_completed: ctx.matches.filter((m) => m.status === 'completed').length,
      },
      teams: ctx.teams.map((t) => {
        const p = paymentsByTeam.get(t.id) ?? null
        return {
          id: t.id,
          name: t.name,
          seed: t.seed,
          status: t.status,
          registered_at: t.registered_at,
          expires_at: t.expires_at,
          paid_at: t.paid_at,
          player1: t.player1,
          player2: t.player2,
          payment: p
            ? {
                id: p.id,
                status: p.status,
                amount: p.amount,
                marketplace_fee: p.marketplace_fee,
                net_amount: p.net_amount,
                refund_status: p.refund_status,
                refunded_amount: p.refunded_amount,
                created_at: p.created_at,
              }
            : null,
        }
      }),
      payments_summary: {
        approved: approved.length,
        gross: approved.reduce((sum, p) => sum + Math.round(p.amount * 100), 0) / 100,
        fee: approved.reduce((sum, p) => sum + Math.round((p.marketplace_fee ?? 0) * 100), 0) / 100,
        refunded: payments.reduce((sum, p) => sum + Math.round(p.refunded_amount * 100), 0) / 100,
        refunds_pending: payments.filter((p) => p.refund_status === 'pending').length,
      },
      matches: ctx.matches.map((m) => matchView(m, ctx.teamNames, ctx.players, tournament.format)),
      standings,
    }
  },

  async updateClubTournament(clubId: string, id: string, actorId: string, patch: UpdateTournamentInput) {
    const current = await tournamentRepository.findClubRecord(clubId, id)
    if (!current) throw new NotFoundError('Tournament')
    if (current.status !== 'draft' && current.status !== 'open') {
      throw new AppError('Only a draft or open tournament can be edited', 409, 'INVALID_STATUS', { status: current.status })
    }

    const structural = ['format', 'max_teams', 'max_players', 'entry_fee', 'min_elo', 'max_elo'] as const
    const touchesStructure = structural.some((k) => patch[k] !== undefined)
    if (touchesStructure && (await tournamentRepository.countTeams(id)) > 0) {
      throw new AppError(
        'Format, size, entry fee and level limits cannot change once there are registrations',
        409,
        'TOURNAMENT_HAS_REGISTRATIONS',
      )
    }

    const format = patch.format ?? current.format
    let maxTeams = current.max_teams
    if (format === 'americano') {
      if (patch.max_teams !== undefined) throw new AppError('americano is sized with max_players', 400, 'VALIDATION_ERROR')
      if (patch.max_players !== undefined) {
        if (patch.max_players % 2 !== 0) throw new AppError('max_players must be even', 400, 'VALIDATION_ERROR')
        maxTeams = patch.max_players / 2
      }
    } else {
      if (patch.max_players !== undefined) throw new AppError('max_players is only for americano', 400, 'VALIDATION_ERROR')
      if (patch.max_teams !== undefined) maxTeams = patch.max_teams
    }
    if (maxTeams < 2) throw new AppError('The tournament needs room for at least 2 registrations', 400, 'VALIDATION_ERROR')

    const merged = {
      start_date: patch.start_date ?? current.start_date,
      end_date: patch.end_date !== undefined ? patch.end_date : current.end_date,
      registration_deadline:
        patch.registration_deadline !== undefined ? patch.registration_deadline : current.registration_deadline,
      min_elo: patch.min_elo !== undefined ? patch.min_elo : current.min_elo,
      max_elo: patch.max_elo !== undefined ? patch.max_elo : current.max_elo,
    }
    const problems: Array<{ path: string; message: string }> = []
    checkRanges(merged, (path, message) => problems.push({ path, message }))
    if (patch.start_date !== undefined && new Date(patch.start_date).getTime() <= Date.now()) {
      problems.push({ path: 'start_date', message: 'start_date must be in the future' })
    }
    if (problems.length > 0) {
      throw new AppError('Invalid tournament data', 400, 'VALIDATION_ERROR', { errors: problems })
    }

    // An open tournament becoming paid must be able to collect.
    if (patch.entry_fee !== undefined && patch.entry_fee > 0 && current.status === 'open') {
      await assertClubCanCharge(clubId, patch.entry_fee)
    }

    const update: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    const assign = (column: string, value: unknown) => {
      const previous = (current as unknown as Record<string, unknown>)[column]
      if (JSON.stringify(previous) === JSON.stringify(value)) return
      update[column] = value
      before[column] = previous
      after[column] = value
    }
    for (const key of [
      'name',
      'description',
      'format',
      'category',
      'min_elo',
      'max_elo',
      'entry_fee',
      'prize_pool',
      'rules',
      'start_date',
      'end_date',
      'registration_deadline',
    ] as const) {
      if (patch[key] !== undefined) assign(key, patch[key])
    }
    if (patch.max_teams !== undefined || patch.max_players !== undefined) assign('max_teams', maxTeams)

    if (Object.keys(update).length === 0) return serializeTournament(current)

    const row = await tournamentRepository.update(id, update, ['draft', 'open'])
    if (!row) throw new AppError('The tournament status changed meanwhile', 409, 'INVALID_STATUS')
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.updated',
      entity: 'tournament',
      entityId: id,
      metadata: { before, after },
    })
    return serializeTournament(row)
  },

  async publishClubTournament(clubId: string, id: string, actorId: string) {
    const current = await tournamentRepository.findClubRecord(clubId, id)
    if (!current) throw new NotFoundError('Tournament')
    const row = await lifecycle.publish(current)
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.published',
      entity: 'tournament',
      entityId: id,
      metadata: { from: 'draft', to: 'open', entry_fee: row.entry_fee },
    })
    return serializeTournament(row as TournamentRow)
  },

  async cancelClubTournament(clubId: string, id: string, actorId: string, reason: string | null) {
    const current = await tournamentRepository.findClubRecord(clubId, id)
    if (!current) throw new NotFoundError('Tournament')
    const result = await lifecycle.cancel({ tournament: current, reason })
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.cancelled',
      entity: 'tournament',
      entityId: id,
      metadata: { from: current.status, to: 'cancelled', reason, refund: result.refund },
    })
    const row = (await tournamentRepository.findClubRecord(clubId, id)) ?? (result.tournament as TournamentRow)
    return {
      ...serializeTournament(row),
      refund: result.refund,
      notified_players: result.notified,
    }
  },

  async startClubTournament(
    clubId: string,
    id: string,
    actorId: string,
    options: { seeding?: 'elo' | 'registration'; americano_rounds?: number },
  ) {
    const current = await tournamentRepository.findClubRecord(clubId, id)
    if (!current) throw new NotFoundError('Tournament')
    const result: StartResult = await lifecycle.start({
      tournament: current,
      seeding: options.seeding,
      americanoRounds: options.americano_rounds,
    })
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.started',
      entity: 'tournament',
      entityId: id,
      metadata: { teams: result.teams, matches: result.matches, byes: result.byes, seeding: result.seeding },
    })
    const row = (await tournamentRepository.findClubRecord(clubId, id)) as TournamentRow
    return { ...serializeTournament(row), fixture: { teams: result.teams, matches: result.matches, byes: result.byes, seeding: result.seeding } }
  },

  async recordClubResult(
    clubId: string,
    id: string,
    matchId: string,
    actorId: string,
    input: { score_team1: number[]; score_team2: number[]; winner?: 'team1' | 'team2' },
  ) {
    const current = await tournamentRepository.findClubRecord(clubId, id)
    if (!current) throw new NotFoundError('Tournament')

    const outcome = await results.recordResult({ tournament: current, matchId, result: input, actorId })
    await recordAudit({
      actorId,
      clubId,
      action: 'tournament.result_recorded',
      entity: 'tournament_match',
      entityId: matchId,
      metadata: {
        tournament_id: id,
        before: outcome.before,
        after: {
          score_team1: outcome.match.score_team1,
          score_team2: outcome.match.score_team2,
          winner_team_id: outcome.match.winner_team_id,
        },
        advanced_match_ids: outcome.changed.map((m) => m.id).filter((x) => x !== matchId),
        tournament_status: outcome.tournament_status,
      },
    })
    if (outcome.completed) {
      await recordAudit({
        actorId,
        clubId,
        action: 'tournament.completed',
        entity: 'tournament',
        entityId: id,
        metadata: { last_match_id: matchId },
      })
    }

    const ctx = await loadMatchContext(id)
    const fresh = (await tournamentRepository.findClubRecord(clubId, id)) as TournamentRow
    const standings = standingsView(
      computeStandings(
        fresh,
        ctx.teams.filter((t) => t.status === 'confirmed'),
        ctx.matches,
      ),
      ctx.teamNames,
      ctx.players,
    )
    const view = (m: MatchRecord) => matchView(m, ctx.teamNames, ctx.players, fresh.format)
    const byId = new Map(ctx.matches.map((m) => [m.id, m]))
    return {
      match: view(byId.get(matchId) as MatchRecord),
      advanced: outcome.changed.filter((m) => m.id !== matchId).map((m) => view(byId.get(m.id) as MatchRecord)),
      tournament: { id, status: fresh.status, completed_at: fresh.completed_at },
      standings,
    }
  },

  async getClubStandings(clubId: string, id: string) {
    const tournament = await tournamentRepository.findClubRecord(clubId, id)
    if (!tournament) throw new NotFoundError('Tournament')
    const ctx = await loadMatchContext(id)
    return {
      tournament_id: id,
      format: tournament.format,
      status: tournament.status,
      ...standingsView(
        computeStandings(tournament, ctx.teams.filter((t) => t.status === 'confirmed'), ctx.matches),
        ctx.teamNames,
        ctx.players,
      ),
    }
  },
}
