// Card #77: tournament orchestration with its collaborators injected (like
// charging.core.ts and refund-policy.core.ts), so the registration payment,
// refund, cancel, start and result flows can be checked without a database or
// Mercado Pago. `tournament.service.ts` and `payment.service.ts` wire the real
// ones. Rules and statuses: docs/tournaments.md.
//
// NOT verified against the Mercado Pago sandbox (card #73).

import { AppError, ConflictError, NotFoundError } from '../../types/errors'
import {
  AMERICANO_MIN_PLAYERS,
  MIN_TEAMS,
  generateFixture,
  FixtureError,
  type FixtureMatch,
  type TournamentFormat,
} from './fixtures.core'
import {
  americanoStandings,
  applyResult,
  BracketError,
  eliminationStandings,
  isFixtureFinished,
  outcomeOf,
  resolveBracket,
  roundRobinStandings,
  type AmericanoRow,
  type BracketMatch,
  type EliminationRow,
  type RoundRobinRow,
} from './bracket.core'
import {
  toPlayerRefundResult,
  type PlayerRefundResult,
  type PolicyRefundPayment,
  type PolicyRefundSummary,
} from '../payments/refund-policy.core'

/** Minutes a registration waits for its payment before it is released. */
export const REGISTRATION_TTL_MINUTES = 30

export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
export type TeamStatus = 'pending_payment' | 'confirmed'

export interface TournamentRecord {
  id: string
  club_id: string
  name: string
  format: TournamentFormat
  status: TournamentStatus
  max_teams: number
  entry_fee: number
  prize_pool: number
  start_date: string
  end_date: string | null
  registration_deadline: string | null
  min_elo: number | null
  max_elo: number | null
  rules: Record<string, unknown>
}

export interface TeamRecord {
  id: string
  tournament_id: string
  name: string
  player1_id: string
  player2_id: string
  seed: number | null
  status: TeamStatus
  registered_at: string
  expires_at: string | null
  paid_at: string | null
  payment_id: string | null
}

export interface MatchRecord extends BracketMatch {
  tournament_id: string
  team1_players: string[] | null
  team2_players: string[] | null
  result_by: string | null
  result_at: string | null
  scheduled_at?: string | null
}

export interface UserLite {
  id: string
  username: string
  elo: number
  is_active: boolean
}

export interface PaymentInit {
  payment_id: string
  preference_id: string
  init_point: string
  sandbox_init_point: string
  amount: number
}

export interface TournamentNotifier {
  registrationConfirmed(userIds: string[], input: { tournamentId: string; name: string; teamName: string }): Promise<void>
  partnerRegistered(partnerId: string, tournamentId: string, teamName: string | null): Promise<void>
  cancelled(userIds: string[], input: { tournamentId: string; name: string; reason: string | null; refunded: boolean }): Promise<void>
  started(userIds: string[], input: { tournamentId: string; name: string }): Promise<void>
  result(userIds: string[], input: { tournamentId: string; name: string; matchId: string; round: number }): Promise<void>
}

function minutes(date: Date, m: number): Date {
  return new Date(date.getTime() + m * 60_000)
}

function teamLabel(users: Map<string, UserLite>, a: string, b: string): string {
  return `${users.get(a)?.username ?? 'jugador'} / ${users.get(b)?.username ?? 'jugador'}`
}

// ---- Registration -----------------------------------------------------------------------------

export interface RegistrationDeps {
  now(): Date
  /** Public tournaments only (not a draft, club approved and active); null otherwise. */
  findPublicTournament(id: string): Promise<TournamentRecord | null>
  findUsers(ids: string[]): Promise<UserLite[]>
  findTeamOfUser(tournamentId: string, userId: string): Promise<TeamRecord | null>
  countConfirmed(tournamentId: string): Promise<number>
  insertTeam(input: {
    tournament_id: string
    player1_id: string
    player2_id: string
    name: string
    status: TeamStatus
    expires_at: string | null
  }): Promise<TeamRecord>
  updateTeam(id: string, patch: Partial<Pick<TeamRecord, 'status' | 'expires_at' | 'paid_at' | 'payment_id' | 'seed'>>): Promise<void>
  deleteTeam(id: string): Promise<void>
  /** Unpaid registrations past their deadline (of one tournament, or all of them). */
  findExpiredPending(now: Date, tournamentId?: string): Promise<TeamRecord[]>
  /** 409 CLUB_PAYMENTS_NOT_ENABLED when the club cannot charge `amount`. */
  assertClubCanCharge(clubId: string, amount: number): Promise<void>
  /** Creates the payment row and the checkout preference (amount is the server's, never the client's). */
  createRegistrationPayment(input: {
    tournament: TournamentRecord
    team: TeamRecord
    payerId: string
    amount: number
  }): Promise<PaymentInit>
  /** Approved payments of a team that were not settled by a refund yet. */
  findRefundablePayments(teamId: string): Promise<PolicyRefundPayment[]>
  refundByPolicy(input: { clubId: string; payments: PolicyRefundPayment[]; startsAt: string }): Promise<PolicyRefundSummary>
  /** Marks the still pending checkout payments of these teams as cancelled. */
  cancelPendingPayments(teamIds: string[]): Promise<void>
  notifier: Pick<TournamentNotifier, 'partnerRegistered'>
  onError(message: string, context: Record<string, unknown>): void
}

export interface RegisterResult {
  team: TeamRecord
  payment_required: boolean
  payment: PaymentInit | null
}

const UNIQUE_VIOLATION = '23505'

function pgCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
}

export function createRegistrationCore(deps: RegistrationDeps) {
  /** Releases the unpaid registrations whose time ran out. Returns how many. */
  async function expirePending(tournamentId?: string): Promise<number> {
    const expired = await deps.findExpiredPending(deps.now(), tournamentId)
    if (expired.length === 0) return 0
    await deps.cancelPendingPayments(expired.map((t) => t.id))
    for (const team of expired) {
      await deps.deleteTeam(team.id)
    }
    return expired.length
  }

  async function registerTeam(input: {
    tournamentId: string
    userId: string
    partnerId: string
    teamName?: string
  }): Promise<RegisterResult> {
    const tournament = await deps.findPublicTournament(input.tournamentId)
    if (!tournament) throw new NotFoundError('Tournament')

    if (tournament.status !== 'open') {
      throw new AppError('Tournament is not open for registration', 400, 'TOURNAMENT_NOT_OPEN')
    }
    const now = deps.now()
    if (tournament.registration_deadline && new Date(tournament.registration_deadline).getTime() <= now.getTime()) {
      throw new AppError('The registration deadline has passed', 409, 'REGISTRATION_CLOSED')
    }
    if (input.partnerId === input.userId) {
      throw new AppError('You cannot be your own partner', 400, 'INVALID_PARTNER')
    }

    const users = await deps.findUsers([input.userId, input.partnerId])
    const byId = new Map(users.map((u) => [u.id, u]))
    const me = byId.get(input.userId)
    const partner = byId.get(input.partnerId)
    if (!me) throw new AppError('Your profile was not found', 400, 'INVALID_PARTNER')
    if (!partner || !partner.is_active) throw new AppError('Partner not found', 400, 'INVALID_PARTNER')

    for (const player of [me, partner]) {
      const below = tournament.min_elo !== null && player.elo < tournament.min_elo
      const above = tournament.max_elo !== null && player.elo > tournament.max_elo
      if (below || above) {
        throw new AppError('A player is outside the level allowed by this tournament', 409, 'LEVEL_NOT_ALLOWED', {
          player_id: player.id,
          elo: player.elo,
          min_elo: tournament.min_elo,
          max_elo: tournament.max_elo,
        })
      }
    }

    // A registration nobody paid must not keep the players or a place blocked.
    await expirePending(tournament.id)

    if (await deps.findTeamOfUser(tournament.id, input.userId)) {
      throw new ConflictError('You are already registered in this tournament')
    }
    if (await deps.findTeamOfUser(tournament.id, input.partnerId)) {
      throw new ConflictError('Your partner is already registered in this tournament')
    }

    // Only confirmed (paid) registrations count against the cap.
    if ((await deps.countConfirmed(tournament.id)) >= tournament.max_teams) {
      throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL')
    }

    const fee = Number(tournament.entry_fee)
    const paid = fee > 0
    // Before anything is created: a club that cannot charge leaves nothing behind.
    if (paid) await deps.assertClubCanCharge(tournament.club_id, fee)

    const name = input.teamName?.trim() || teamLabel(byId, input.userId, input.partnerId)
    let team: TeamRecord
    try {
      team = await deps.insertTeam({
        tournament_id: tournament.id,
        player1_id: input.userId,
        player2_id: input.partnerId,
        name,
        status: paid ? 'pending_payment' : 'confirmed',
        expires_at: paid ? minutes(now, REGISTRATION_TTL_MINUTES).toISOString() : null,
      })
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION) {
        throw new ConflictError('You or your partner are already registered in this tournament')
      }
      throw err
    }

    if (!paid) {
      // Best effort against two simultaneous registrations for the last place.
      if ((await deps.countConfirmed(tournament.id)) > tournament.max_teams) {
        await deps.deleteTeam(team.id)
        throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL')
      }
      deps.notifier
        .partnerRegistered(input.partnerId, tournament.id, input.teamName?.trim() || null)
        .catch((err) => deps.onError('Failed to notify the partner', { err: String(err) }))
      return { team, payment_required: false, payment: null }
    }

    let payment: PaymentInit
    try {
      payment = await deps.createRegistrationPayment({ tournament, team, payerId: input.userId, amount: fee })
    } catch (err) {
      await deps.deleteTeam(team.id).catch((e) => deps.onError('Failed to release the registration', { err: String(e) }))
      throw err
    }
    await deps.updateTeam(team.id, { payment_id: payment.payment_id })
    return { team: { ...team, payment_id: payment.payment_id }, payment_required: true, payment }
  }

  /**
   * The player withdraws before the start. Allowed while the tournament is
   * `open`; what was paid goes back per the club's refund policy (cutoff
   * measured against the tournament's `start_date`).
   */
  async function withdraw(input: {
    tournament: TournamentRecord | null
    userId: string
  }): Promise<{ refund: PlayerRefundResult | null; team: TeamRecord }> {
    const { tournament } = input
    if (!tournament) throw new NotFoundError('Tournament')
    if (tournament.status === 'completed') {
      throw new AppError('Cannot withdraw from a completed tournament', 400, 'TOURNAMENT_COMPLETED')
    }
    if (tournament.status === 'cancelled') {
      throw new AppError('The tournament was cancelled', 409, 'TOURNAMENT_CANCELLED')
    }
    if (tournament.status === 'in_progress') {
      throw new AppError(
        'The tournament has started: contact the club to leave it',
        409,
        'TOURNAMENT_ALREADY_STARTED',
      )
    }

    const team = await deps.findTeamOfUser(tournament.id, input.userId)
    if (!team) throw new AppError('You are not registered in this tournament', 400, 'NOT_REGISTERED')

    let refund: PlayerRefundResult | null = null
    if (team.status === 'confirmed') {
      const payments = await deps.findRefundablePayments(team.id)
      if (payments.length > 0) {
        const summary = await deps.refundByPolicy({
          clubId: tournament.club_id,
          payments,
          startsAt: tournament.start_date,
        })
        refund = toPlayerRefundResult(summary)
      }
    }
    // An unpaid checkout that is left open must not confirm a registration that no longer exists.
    await deps.cancelPendingPayments([team.id])
    await deps.deleteTeam(team.id)
    return { refund, team }
  }

  return { expirePending, registerTeam, withdraw }
}

export type RegistrationCore = ReturnType<typeof createRegistrationCore>

// ---- Payment confirmation (webhook) -----------------------------------------------------------

export interface ConfirmDeps {
  now(): Date
  findTeam(id: string): Promise<TeamRecord | null>
  findTournament(id: string): Promise<TournamentRecord | null>
  countConfirmed(tournamentId: string): Promise<number>
  updateTeam(id: string, patch: Partial<Pick<TeamRecord, 'status' | 'expires_at' | 'paid_at' | 'payment_id'>>): Promise<void>
  deleteTeam(id: string): Promise<void>
  /** Full refund of one approved payment (the club's money goes back). true when completed; never throws. */
  refundInFull(paymentId: string, reason: string): Promise<boolean>
  findUsers(ids: string[]): Promise<UserLite[]>
  notifier: Pick<TournamentNotifier, 'registrationConfirmed'>
  onError(message: string, context: Record<string, unknown>): void
}

export type ConfirmOutcome =
  | { outcome: 'confirmed' }
  | { outcome: 'already_confirmed' }
  | { outcome: 'refunded'; reason: string }
  | { outcome: 'refund_pending'; reason: string }

/**
 * An APPROVED payment of a registration arrived. Idempotent (a repeated
 * notification, or a different payment of an already confirmed team, never
 * confirms twice) and it never keeps money for a place that does not exist: if
 * the registration expired, the tournament is no longer open or it filled up in
 * the meantime, the payment is returned in full.
 */
export function createConfirmationCore(deps: ConfirmDeps) {
  async function giveBack(paymentId: string, reason: string): Promise<ConfirmOutcome> {
    const ok = await deps.refundInFull(paymentId, reason)
    return ok ? { outcome: 'refunded', reason } : { outcome: 'refund_pending', reason }
  }

  async function confirmPaidRegistration(input: {
    paymentId: string
    teamId: string | null
    tournamentId: string | null
  }): Promise<ConfirmOutcome> {
    const team = input.teamId ? await deps.findTeam(input.teamId) : null
    if (!team) return giveBack(input.paymentId, 'REGISTRATION_EXPIRED')

    if (team.status === 'confirmed') {
      if (team.payment_id === input.paymentId || team.payment_id === null) return { outcome: 'already_confirmed' }
      return giveBack(input.paymentId, 'DUPLICATE_PAYMENT')
    }

    const tournament = await deps.findTournament(team.tournament_id)
    if (!tournament || tournament.status !== 'open') {
      if (tournament && tournament.status === 'in_progress') await deps.deleteTeam(team.id)
      return giveBack(input.paymentId, 'TOURNAMENT_NOT_OPEN')
    }

    if ((await deps.countConfirmed(tournament.id)) >= tournament.max_teams) {
      await deps.deleteTeam(team.id)
      return giveBack(input.paymentId, 'TOURNAMENT_FULL')
    }

    await deps.updateTeam(team.id, {
      status: 'confirmed',
      paid_at: deps.now().toISOString(),
      expires_at: null,
      payment_id: input.paymentId,
    })

    deps.notifier
      .registrationConfirmed([team.player1_id, team.player2_id], {
        tournamentId: tournament.id,
        name: tournament.name,
        teamName: team.name,
      })
      .catch((err) => deps.onError('Failed to notify the registration confirmation', { err: String(err) }))
    return { outcome: 'confirmed' }
  }

  return { confirmPaidRegistration }
}

// ---- Lifecycle: publish, cancel, start ------------------------------------------------------------

export interface LifecycleDeps {
  now(): Date
  newId(): string
  findClubState(clubId: string): Promise<{ status: string; is_active: boolean } | null>
  assertClubCanCharge(clubId: string, amount: number): Promise<void>
  setStatus(
    id: string,
    patch: { status: TournamentStatus; started_at?: string; completed_at?: string; cancelled_at?: string; cancel_reason?: string | null },
    expected?: TournamentStatus[],
  ): Promise<TournamentRecord | null>
  listTeams(tournamentId: string): Promise<TeamRecord[]>
  updateTeam(id: string, patch: Partial<Pick<TeamRecord, 'seed'>>): Promise<void>
  deleteTeam(id: string): Promise<void>
  findUsers(ids: string[]): Promise<UserLite[]>
  expirePending(tournamentId: string): Promise<number>
  cancelPendingPayments(teamIds: string[]): Promise<void>
  /** Approved, unsettled payments of the tournament refunded at 100% (club-initiated). */
  refundAllPayments(tournamentId: string): Promise<{ payments: number; refunded: number; failed: string[]; amount_refunded: number }>
  insertMatches(rows: MatchRecord[]): Promise<void>
  updateMatch(id: string, patch: Partial<MatchRecord>): Promise<void>
  deleteMatches(tournamentId: string): Promise<void>
  setBracketMeta(tournamentId: string, meta: Record<string, unknown>): Promise<void>
  notifier: Pick<TournamentNotifier, 'cancelled' | 'started'>
  onError(message: string, context: Record<string, unknown>): void
}

export interface CancelResult {
  tournament: TournamentRecord
  refund: { payments: number; refunded: number; failed: string[]; amount_refunded: number }
  notified: number
}

export interface StartResult {
  tournament: TournamentRecord
  teams: number
  matches: number
  byes: number
  seeding: 'elo' | 'registration'
}

export function createLifecycleCore(deps: LifecycleDeps) {
  async function publish(tournament: TournamentRecord): Promise<TournamentRecord> {
    if (tournament.status !== 'draft') {
      throw new AppError('Only a draft tournament can be published', 409, 'INVALID_STATUS', { status: tournament.status })
    }
    const club = await deps.findClubState(tournament.club_id)
    if (!club || club.status !== 'approved' || !club.is_active) {
      throw new AppError('The club must be approved and active to publish a tournament', 409, 'CLUB_NOT_APPROVED')
    }
    const now = deps.now().getTime()
    if (new Date(tournament.start_date).getTime() <= now) {
      throw new AppError('The start date is in the past', 409, 'INVALID_DATES')
    }
    if (tournament.registration_deadline && new Date(tournament.registration_deadline).getTime() <= now) {
      throw new AppError('The registration deadline is in the past', 409, 'INVALID_DATES')
    }
    // A paid tournament needs a club that can collect the fee (409 CLUB_PAYMENTS_NOT_ENABLED).
    if (Number(tournament.entry_fee) > 0) await deps.assertClubCanCharge(tournament.club_id, Number(tournament.entry_fee))

    const updated = await deps.setStatus(tournament.id, { status: 'open' }, ['draft'])
    if (!updated) throw new AppError('The tournament status changed meanwhile', 409, 'INVALID_STATUS')
    return updated
  }

  /**
   * Club cancellation: the status changes FIRST (no new registration, and a late
   * approved payment is returned by the confirmation flow), then every approved
   * payment is refunded at 100% (club-initiated, never the player policy).
   */
  async function cancel(input: { tournament: TournamentRecord; reason: string | null }): Promise<CancelResult> {
    const { tournament } = input
    if (!(tournament.status === 'draft' || tournament.status === 'open' || tournament.status === 'in_progress')) {
      throw new AppError('This tournament can no longer be cancelled', 409, 'INVALID_STATUS', { status: tournament.status })
    }
    const updated = await deps.setStatus(
      tournament.id,
      { status: 'cancelled', cancelled_at: deps.now().toISOString(), cancel_reason: input.reason },
      ['draft', 'open', 'in_progress'],
    )
    if (!updated) throw new AppError('The tournament status changed meanwhile', 409, 'INVALID_STATUS')

    const teams = await deps.listTeams(tournament.id)
    await deps.cancelPendingPayments(teams.filter((t) => t.status === 'pending_payment').map((t) => t.id))
    const refund = await deps.refundAllPayments(tournament.id)

    const paidUsers = new Set(teams.filter((t) => t.status === 'confirmed' && Number(tournament.entry_fee) > 0).flatMap((t) => [t.player1_id, t.player2_id]))
    const everyone = [...new Set(teams.flatMap((t) => [t.player1_id, t.player2_id]))]
    for (const group of [
      { users: everyone.filter((u) => paidUsers.has(u)), refunded: true },
      { users: everyone.filter((u) => !paidUsers.has(u)), refunded: false },
    ]) {
      if (group.users.length === 0) continue
      await deps.notifier
        .cancelled(group.users, {
          tournamentId: tournament.id,
          name: tournament.name,
          reason: input.reason,
          refunded: group.refunded,
        })
        .catch((err) => deps.onError('Failed to notify the tournament cancellation', { err: String(err) }))
    }
    return { tournament: updated, refund, notified: everyone.length }
  }

  async function start(input: {
    tournament: TournamentRecord
    seeding?: 'elo' | 'registration'
    americanoRounds?: number
  }): Promise<StartResult> {
    const { tournament } = input
    if (tournament.status !== 'open') {
      throw new AppError('Only an open tournament can be started', 409, 'INVALID_STATUS', { status: tournament.status })
    }

    // Unpaid registrations do not play.
    await deps.expirePending(tournament.id)
    const all = await deps.listTeams(tournament.id)
    const unpaid = all.filter((t) => t.status !== 'confirmed')
    if (unpaid.length > 0) {
      await deps.cancelPendingPayments(unpaid.map((t) => t.id))
      for (const t of unpaid) await deps.deleteTeam(t.id)
    }
    const teams = all.filter((t) => t.status === 'confirmed')

    const min = MIN_TEAMS[tournament.format]
    if (teams.length < min) {
      throw new AppError(`At least ${min} registered teams are needed to start`, 409, 'NOT_ENOUGH_TEAMS', {
        minimum: min,
        confirmed: teams.length,
      })
    }

    // Seeds: combined ELO of the two players, best first; ties by registration time then id.
    const seeding = input.seeding ?? 'elo'
    const users = await deps.findUsers(teams.flatMap((t) => [t.player1_id, t.player2_id]))
    const elo = new Map(users.map((u) => [u.id, u.elo]))
    const strength = (t: TeamRecord) => (elo.get(t.player1_id) ?? 0) + (elo.get(t.player2_id) ?? 0)
    const ordered = [...teams].sort((a, b) => {
      if (seeding === 'elo' && strength(a) !== strength(b)) return strength(b) - strength(a)
      if (a.registered_at !== b.registered_at) return a.registered_at < b.registered_at ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

    let fixture: FixtureMatch[]
    try {
      const rulesRounds = Number((tournament.rules as { americano_rounds?: unknown }).americano_rounds)
      fixture = generateFixture(tournament.format, ordered.map((t) => t.id), {
        playersBestSeedFirst: ordered.flatMap((t) => [t.player1_id, t.player2_id]),
        americano: {
          rounds: input.americanoRounds ?? (Number.isInteger(rulesRounds) && rulesRounds > 0 ? rulesRounds : undefined),
        },
      })
    } catch (err) {
      if (err instanceof FixtureError) throw new AppError(err.message, 409, err.code)
      throw err
    }
    if (tournament.format === 'americano' && ordered.length * 2 < AMERICANO_MIN_PLAYERS) {
      throw new AppError('Not enough players', 409, 'NOT_ENOUGH_TEAMS')
    }

    // Claim the start (open -> in_progress) so two starts cannot both generate a fixture.
    const claimed = await deps.setStatus(tournament.id, { status: 'in_progress', started_at: deps.now().toISOString() }, ['open'])
    if (!claimed) throw new AppError('The tournament status changed meanwhile', 409, 'INVALID_STATUS')

    try {
      for (let i = 0; i < ordered.length; i++) await deps.updateTeam(ordered[i].id, { seed: i + 1 })

      const idOf = new Map(fixture.map((m) => [m.key, deps.newId()]))
      let rows: MatchRecord[] = fixture.map((m) => ({
        id: idOf.get(m.key) as string,
        tournament_id: tournament.id,
        stage: m.stage,
        round: m.round,
        position: m.position,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        winner_team_id: null,
        score_team1: null,
        score_team2: null,
        status: tournament.format === 'americano' || tournament.format === 'round_robin' ? 'ready' : 'pending',
        next_match_id: m.next ? (idOf.get(m.next.key) as string) : null,
        next_match_slot: m.next?.slot ?? null,
        loser_next_match_id: m.loser_next ? (idOf.get(m.loser_next.key) as string) : null,
        loser_next_match_slot: m.loser_next?.slot ?? null,
        team1_players: m.team1_players,
        team2_players: m.team2_players,
        result_by: null,
        result_at: null,
      }))
      if (tournament.format === 'single_elimination' || tournament.format === 'double_elimination') {
        rows = resolveBracket(rows).map((r, i) => ({ ...rows[i], ...r }))
      }
      await deps.insertMatches(rows)
      await deps.setBracketMeta(tournament.id, {
        format: tournament.format,
        seeding,
        generated_at: deps.now().toISOString(),
        teams: ordered.length,
        matches: rows.length,
        seed_order: ordered.map((t) => t.id),
      })

      const players = ordered.flatMap((t) => [t.player1_id, t.player2_id])
      deps.notifier
        .started(players, { tournamentId: tournament.id, name: tournament.name })
        .catch((err) => deps.onError('Failed to notify the tournament start', { err: String(err) }))

      return {
        tournament: claimed,
        teams: ordered.length,
        matches: rows.length,
        byes: rows.filter((r) => r.status === 'bye').length,
        seeding,
      }
    } catch (err) {
      // Undo: the tournament goes back to `open`, with no half generated fixture.
      await deps.deleteMatches(tournament.id).catch((e) => deps.onError('Failed to remove a partial fixture', { err: String(e) }))
      await deps
        .setStatus(tournament.id, { status: 'open' }, ['in_progress'])
        .catch((e) => deps.onError('Failed to reopen the tournament after a failed start', { err: String(e) }))
      throw err
    }
  }

  return { publish, cancel, start }
}

export type LifecycleCore = ReturnType<typeof createLifecycleCore>

// ---- Results ---------------------------------------------------------------------------------------

export interface ResultDeps {
  now(): Date
  listMatches(tournamentId: string): Promise<MatchRecord[]>
  updateMatch(id: string, patch: Partial<MatchRecord>): Promise<void>
  listTeams(tournamentId: string): Promise<TeamRecord[]>
  setStatus(
    id: string,
    patch: { status: TournamentStatus; completed_at?: string },
    expected?: TournamentStatus[],
  ): Promise<TournamentRecord | null>
  notifier: Pick<TournamentNotifier, 'result'>
  onError(message: string, context: Record<string, unknown>): void
}

export interface ResultInput {
  score_team1: number[]
  score_team2: number[]
  /** Required only when the score does not decide it (a tie in an elimination or round robin match). */
  winner?: 'team1' | 'team2'
}

export interface TournamentStandings {
  type: 'none' | 'round_robin' | 'elimination' | 'americano'
  rows: Array<RoundRobinRow | EliminationRow | AmericanoRow>
}

export function computeStandings(
  tournament: Pick<TournamentRecord, 'format' | 'status'>,
  teams: TeamRecord[],
  matches: MatchRecord[],
): TournamentStandings {
  if (matches.length === 0) return { type: 'none', rows: [] }
  const refs = teams.map((t) => ({ id: t.id, seed: t.seed }))
  switch (tournament.format) {
    case 'round_robin':
      return { type: 'round_robin', rows: roundRobinStandings(refs, matches) }
    case 'single_elimination':
    case 'double_elimination': {
      const rows = eliminationStandings(refs, matches)
      rows.sort((a, b) => {
        const pa = a.placement ?? Number.MAX_SAFE_INTEGER
        const pb = b.placement ?? Number.MAX_SAFE_INTEGER
        return pa - pb || (a.team_id < b.team_id ? -1 : 1)
      })
      return { type: 'elimination', rows }
    }
    case 'americano': {
      const players = teams.flatMap((t) => [t.player1_id, t.player2_id])
      return { type: 'americano', rows: americanoStandings(players, matches) }
    }
  }
}

function validateScore(format: TournamentFormat, input: ResultInput): void {
  const a = input.score_team1
  const b = input.score_team2
  if (a.length !== b.length) {
    throw new AppError('Both teams need the same number of sets', 400, 'VALIDATION_ERROR')
  }
  if (format === 'americano') {
    if (a.length !== 1) throw new AppError('An americano match has a single score per side', 400, 'VALIDATION_ERROR')
  } else if (a.length < 1 || a.length > 5) {
    throw new AppError('A match has between 1 and 5 sets', 400, 'VALIDATION_ERROR')
  }
}

export function createResultCore(deps: ResultDeps) {
  async function recordResult(input: {
    tournament: TournamentRecord
    matchId: string
    result: ResultInput
    actorId: string
  }): Promise<{
    match: MatchRecord
    changed: MatchRecord[]
    tournament_status: TournamentStatus
    completed: boolean
    before: { score_team1: number[] | null; score_team2: number[] | null; winner_team_id: string | null }
  }> {
    const { tournament } = input
    if (!(tournament.status === 'in_progress' || tournament.status === 'completed')) {
      throw new AppError('Results can only be recorded in a tournament that has started', 409, 'INVALID_STATUS', {
        status: tournament.status,
      })
    }
    validateScore(tournament.format, input.result)

    const matches = await deps.listMatches(tournament.id)
    const target = matches.find((m) => m.id === input.matchId)
    if (!target) throw new NotFoundError('Match')
    const before = {
      score_team1: target.score_team1,
      score_team2: target.score_team2,
      winner_team_id: target.winner_team_id,
    }

    const outcome = outcomeOf({ score_team1: input.result.score_team1, score_team2: input.result.score_team2 })
    const explicit = input.result.winner === 'team1' ? 1 : input.result.winner === 'team2' ? 2 : null
    let winner: 1 | 2 | null = outcome.winner
    if (explicit !== null && outcome.winner !== null && explicit !== outcome.winner) {
      throw new AppError('The winner does not match the score', 400, 'WINNER_MISMATCH')
    }
    if (winner === null) {
      if (tournament.format === 'americano') {
        winner = null // a draw is a valid americano result
      } else if (explicit !== null) {
        winner = explicit
      } else {
        throw new AppError('The score is a tie: say which team won', 400, 'WINNER_REQUIRED')
      }
    }

    const resultAt = deps.now().toISOString()
    let changed: MatchRecord[]
    let updatedMatches: MatchRecord[]

    if (tournament.format === 'americano') {
      if (!(target.status === 'ready' || target.status === 'completed')) {
        throw new AppError('This match cannot take a result', 409, 'MATCH_NOT_READY', { status: target.status })
      }
      const row: MatchRecord = {
        ...target,
        status: 'completed',
        score_team1: input.result.score_team1,
        score_team2: input.result.score_team2,
        result_by: input.actorId,
        result_at: resultAt,
      }
      updatedMatches = matches.map((m) => (m.id === target.id ? row : m))
      changed = [row]
    } else {
      let applied: ReturnType<typeof applyResult>
      try {
        applied = applyResult(matches, target.id, {
          score_team1: input.result.score_team1,
          score_team2: input.result.score_team2,
          winner,
        })
      } catch (err) {
        if (err instanceof BracketError) {
          const status = err.code === 'RESULT_LOCKED' || err.code === 'MATCH_NOT_READY' ? 409 : err.code === 'NOT_FOUND' ? 404 : 400
          throw new AppError(err.message, status, err.code, err.details)
        }
        throw err
      }
      const byId = new Map(matches.map((m) => [m.id, m]))
      updatedMatches = applied.matches.map((m) => {
        const original = byId.get(m.id) as MatchRecord
        const merged = { ...original, ...m } as MatchRecord
        if (m.id === target.id) {
          merged.result_by = input.actorId
          merged.result_at = resultAt
        }
        return merged
      })
      const touched = new Set([...applied.changedIds, target.id])
      changed = updatedMatches.filter((m) => touched.has(m.id))
    }

    for (const row of changed) {
      await deps.updateMatch(row.id, {
        status: row.status,
        team1_id: row.team1_id,
        team2_id: row.team2_id,
        winner_team_id: row.winner_team_id,
        score_team1: row.score_team1,
        score_team2: row.score_team2,
        result_by: row.result_by,
        result_at: row.result_at,
      })
    }

    const finished = isFixtureFinished(updatedMatches)
    let status = tournament.status
    if (finished && tournament.status === 'in_progress') {
      const done = await deps.setStatus(
        tournament.id,
        { status: 'completed', completed_at: resultAt },
        ['in_progress'],
      )
      if (done) status = 'completed'
    }

    const matchRow = updatedMatches.find((m) => m.id === target.id) as MatchRecord
    deps
      .listTeams(tournament.id)
      .then((teams) => {
        const byTeam = new Map(teams.map((t) => [t.id, t]))
        const users = new Set<string>([...(matchRow.team1_players ?? []), ...(matchRow.team2_players ?? [])])
        for (const id of [matchRow.team1_id, matchRow.team2_id]) {
          const t = id ? byTeam.get(id) : undefined
          if (t) {
            users.add(t.player1_id)
            users.add(t.player2_id)
          }
        }
        if (users.size === 0) return undefined
        return deps.notifier.result([...users], {
          tournamentId: tournament.id,
          name: tournament.name,
          matchId: matchRow.id,
          round: matchRow.round,
        })
      })
      .catch((err) => deps.onError('Failed to notify the match result', { err: String(err) }))

    return { match: matchRow, changed, tournament_status: status, completed: status === 'completed', before }
  }

  return { recordResult }
}

export type ResultCore = ReturnType<typeof createResultCore>
