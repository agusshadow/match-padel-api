// Card #77: results, bracket advancement and standings. Pure (no database).
// Rules and tie-breakers: docs/tournaments.md.

import type { MatchStage } from './fixtures.core'

export type FixtureMatchStatus = 'pending' | 'ready' | 'completed' | 'bye' | 'void'

/** What the bracket logic needs of a `tournament_matches` row. */
export interface BracketMatch {
  id: string
  stage: MatchStage
  round: number
  position: number | null
  team1_id: string | null
  team2_id: string | null
  winner_team_id: string | null
  score_team1: number[] | null
  score_team2: number[] | null
  status: FixtureMatchStatus | string
  next_match_id: string | null
  next_match_slot: number | null
  loser_next_match_id: string | null
  loser_next_match_slot: number | null
}

export class BracketError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'BracketError'
  }
}

// ---- Scores ----------------------------------------------------------------------------------

export interface ScoreInput {
  score_team1: number[]
  score_team2: number[]
}

export interface MatchOutcome {
  /** 1, 2 or null for a draw. */
  winner: 1 | 2 | null
  sets_team1: number
  sets_team2: number
  games_team1: number
  games_team2: number
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

/** Sets won by each side and games in total. */
export function outcomeOf(score: ScoreInput): MatchOutcome {
  let s1 = 0
  let s2 = 0
  const n = Math.min(score.score_team1.length, score.score_team2.length)
  for (let i = 0; i < n; i++) {
    if (score.score_team1[i] > score.score_team2[i]) s1++
    else if (score.score_team2[i] > score.score_team1[i]) s2++
  }
  const g1 = sum(score.score_team1)
  const g2 = sum(score.score_team2)
  let winner: 1 | 2 | null = null
  if (s1 !== s2) winner = s1 > s2 ? 1 : 2
  else if (g1 !== g2) winner = g1 > g2 ? 1 : 2
  return { winner, sets_team1: s1, sets_team2: s2, games_team1: g1, games_team2: g2 }
}

// ---- Resolution ------------------------------------------------------------------------------

type SlotState = { kind: 'team'; id: string } | { kind: 'void' } | { kind: 'unknown' }

/** A match is "played" when a result was recorded for it (status completed with a winner side known). */
function isPlayed(m: BracketMatch): boolean {
  return m.status === 'completed'
}

/**
 * Recomputes, from the matches that have a RECORDED result and the teams
 * assigned directly to round 1, the teams of every slot fed by another match
 * and the automatic outcomes: a match with a single possible team is a `bye`
 * (that team advances), a match nobody can ever reach is `void`.
 *
 * Returns new objects; the input is not modified. Matches that were played
 * keep their recorded result; only their teams are refreshed.
 */
export function resolveBracket(input: BracketMatch[]): BracketMatch[] {
  const matches = input.map((m) => ({ ...m }))
  const byId = new Map(matches.map((m) => [m.id, m]))

  // feeders[matchId][slot] = { from, take }
  const feeders = new Map<string, { 1?: { from: string; take: 'winner' | 'loser' }; 2?: { from: string; take: 'winner' | 'loser' } }>()
  const addFeeder = (target: string | null, slot: number | null, from: string, take: 'winner' | 'loser') => {
    if (!target || (slot !== 1 && slot !== 2) || !byId.has(target)) return
    const entry = feeders.get(target) ?? {}
    entry[slot] = { from, take }
    feeders.set(target, entry)
  }
  for (const m of matches) {
    addFeeder(m.next_match_id, m.next_match_slot, m.id, 'winner')
    addFeeder(m.loser_next_match_id, m.loser_next_match_slot, m.id, 'loser')
  }

  // The teams a match had before resolving, for matches without feeders.
  const direct = new Map(matches.map((m) => [m.id, { 1: m.team1_id, 2: m.team2_id }]))

  const slotState = (m: BracketMatch, slot: 1 | 2): SlotState => {
    const feeder = feeders.get(m.id)?.[slot]
    if (!feeder) {
      const team = direct.get(m.id)?.[slot] ?? null
      return team ? { kind: 'team', id: team } : { kind: 'void' }
    }
    const from = byId.get(feeder.from) as BracketMatch
    if (from.status === 'void') return { kind: 'void' }
    if (isPlayed(from)) {
      if (feeder.take === 'winner') {
        return from.winner_team_id ? { kind: 'team', id: from.winner_team_id } : { kind: 'void' }
      }
      const loser = loserOf(from)
      return loser ? { kind: 'team', id: loser } : { kind: 'void' }
    }
    if (from.status === 'bye') {
      return feeder.take === 'winner' && from.winner_team_id
        ? { kind: 'team', id: from.winner_team_id }
        : { kind: 'void' }
    }
    return { kind: 'unknown' }
  }

  const limit = matches.length * 2 + 4
  for (let pass = 0; pass < limit; pass++) {
    let changed = false
    for (const m of matches) {
      const a = slotState(m, 1)
      const b = slotState(m, 2)
      const t1 = a.kind === 'team' ? a.id : null
      const t2 = b.kind === 'team' ? b.id : null

      if (isPlayed(m)) {
        // A recorded result is never rewritten here. Its teams are refreshed so
        // that `applyResult` can see that an edit upstream changed who it was
        // played by (and refuse the edit).
        if (m.team1_id !== t1 || m.team2_id !== t2) {
          m.team1_id = t1
          m.team2_id = t2
          changed = true
        }
        continue
      }

      let status: FixtureMatchStatus
      let winner: string | null = null
      if (a.kind === 'void' && b.kind === 'void') {
        status = 'void'
      } else if (a.kind === 'void' && b.kind === 'team') {
        status = 'bye'
        winner = b.id
      } else if (b.kind === 'void' && a.kind === 'team') {
        status = 'bye'
        winner = a.id
      } else if (a.kind === 'team' && b.kind === 'team') {
        status = 'ready'
      } else {
        status = 'pending'
      }

      if (m.team1_id !== t1 || m.team2_id !== t2 || m.status !== status || m.winner_team_id !== winner) {
        m.team1_id = t1
        m.team2_id = t2
        m.status = status
        m.winner_team_id = winner
        m.score_team1 = null
        m.score_team2 = null
        changed = true
      }
    }
    if (!changed) break
  }
  return matches
}

/** The team that lost a played match (null when it is not a played match with two teams). */
export function loserOf(m: BracketMatch): string | null {
  if (!isPlayed(m) || !m.winner_team_id || !m.team1_id || !m.team2_id) return null
  return m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id
}

/** True when every match is settled (played, bye or void): the tournament is over. */
export function isFixtureFinished(matches: BracketMatch[]): boolean {
  return matches.length > 0 && matches.every((m) => m.status === 'completed' || m.status === 'bye' || m.status === 'void')
}

export interface RecordedResult {
  score_team1: number[]
  score_team2: number[]
  /** 1 or 2; null only for a draw (americano). */
  winner: 1 | 2 | null
}

/**
 * Records (or corrects) the result of `matchId` and resolves the bracket.
 * Rules:
 *  - the match must have both teams (`ready`) or already be played (a correction);
 *  - a correction that CHANGES the winner is refused (409 RESULT_LOCKED) when any
 *    match fed by it has been played with the teams that came from it; changing
 *    only the score is always allowed.
 */
export function applyResult(
  current: BracketMatch[],
  matchId: string,
  result: RecordedResult,
): { matches: BracketMatch[]; changedIds: string[] } {
  const target = current.find((m) => m.id === matchId)
  if (!target) throw new BracketError('Match not found', 'NOT_FOUND')

  if (!(target.status === 'ready' || target.status === 'completed')) {
    throw new BracketError('The teams of this match are not decided yet', 'MATCH_NOT_READY', { status: target.status })
  }
  if (!target.team1_id || !target.team2_id) {
    throw new BracketError('The teams of this match are not decided yet', 'MATCH_NOT_READY', { status: target.status })
  }

  const winnerTeam = result.winner === null ? null : result.winner === 1 ? target.team1_id : target.team2_id
  const edited = current.map((m) =>
    m.id === matchId
      ? {
          ...m,
          status: 'completed',
          winner_team_id: winnerTeam,
          score_team1: result.score_team1,
          score_team2: result.score_team2,
        }
      : { ...m },
  )

  const resolved = resolveBracket(edited)

  // A played match whose teams changed because of this edit blocks it.
  const locked = resolved.filter((after) => {
    if (after.id === matchId) return false
    const before = current.find((m) => m.id === after.id)
    if (!before || before.status !== 'completed') return false
    return before.team1_id !== after.team1_id || before.team2_id !== after.team2_id
  })
  if (locked.length > 0) {
    throw new BracketError(
      'A match that depends on this result has already been played',
      'RESULT_LOCKED',
      { match_ids: locked.map((m) => m.id) },
    )
  }

  const changedIds = resolved
    .filter((after) => {
      const before = current.find((m) => m.id === after.id)
      return (
        !before ||
        before.status !== after.status ||
        before.team1_id !== after.team1_id ||
        before.team2_id !== after.team2_id ||
        before.winner_team_id !== after.winner_team_id ||
        JSON.stringify(before.score_team1) !== JSON.stringify(after.score_team1) ||
        JSON.stringify(before.score_team2) !== JSON.stringify(after.score_team2)
      )
    })
    .map((m) => m.id)

  return { matches: resolved, changedIds }
}

// ---- Standings: round robin ----------------------------------------------------------------------

export interface TeamRef {
  id: string
  /** Lower is better; null last. */
  seed: number | null
}

export interface RoundRobinRow {
  team_id: string
  position: number
  played: number
  wins: number
  losses: number
  points: number
  sets_won: number
  sets_lost: number
  set_diff: number
  games_won: number
  games_lost: number
  game_diff: number
}

export const POINTS_PER_WIN = 3

interface Tally {
  played: number
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
}

function emptyTally(): Tally {
  return { played: 0, wins: 0, losses: 0, sets_won: 0, sets_lost: 0, games_won: 0, games_lost: 0 }
}

function tallyMatches(teamIds: string[], matches: BracketMatch[]): Map<string, Tally> {
  const out = new Map(teamIds.map((id) => [id, emptyTally()]))
  for (const m of matches) {
    if (m.status !== 'completed' || !m.team1_id || !m.team2_id) continue
    const a = out.get(m.team1_id)
    const b = out.get(m.team2_id)
    if (!a || !b) continue
    const o = outcomeOf({ score_team1: m.score_team1 ?? [], score_team2: m.score_team2 ?? [] })
    a.played++
    b.played++
    a.sets_won += o.sets_team1
    a.sets_lost += o.sets_team2
    b.sets_won += o.sets_team2
    b.sets_lost += o.sets_team1
    a.games_won += o.games_team1
    a.games_lost += o.games_team2
    b.games_won += o.games_team2
    b.games_lost += o.games_team1
    if (m.winner_team_id === m.team1_id) {
      a.wins++
      b.losses++
    } else if (m.winner_team_id === m.team2_id) {
      b.wins++
      a.losses++
    }
  }
  return out
}

/**
 * Round robin table. Points: 3 per win, 0 per loss (there are no draws in a
 * round robin). Ties on points are broken, in order, by:
 *  1. head-to-head points among the tied teams only (mini league),
 *  2. head-to-head set difference, 3. head-to-head game difference,
 *  4. overall set difference, 5. overall game difference, 6. games won,
 *  7. seed (lower first), 8. team id (deterministic).
 * Positions are always strictly ordered (1..N).
 */
export function roundRobinStandings(teams: TeamRef[], matches: BracketMatch[]): RoundRobinRow[] {
  const ids = teams.map((t) => t.id)
  const overall = tallyMatches(ids, matches)
  const seedOf = new Map(teams.map((t) => [t.id, t.seed]))
  const pointsOf = (id: string) => (overall.get(id) as Tally).wins * POINTS_PER_WIN

  // Group by points to build the mini league of each group.
  const groups = new Map<number, string[]>()
  for (const id of ids) {
    const p = pointsOf(id)
    groups.set(p, [...(groups.get(p) ?? []), id])
  }
  const h2h = new Map<string, { points: number; set_diff: number; game_diff: number }>()
  for (const members of groups.values()) {
    const set = new Set(members)
    const within = matches.filter((m) => m.team1_id && m.team2_id && set.has(m.team1_id) && set.has(m.team2_id))
    const t = tallyMatches(members, within)
    for (const id of members) {
      const row = t.get(id) as Tally
      h2h.set(id, {
        points: row.wins * POINTS_PER_WIN,
        set_diff: row.sets_won - row.sets_lost,
        game_diff: row.games_won - row.games_lost,
      })
    }
  }

  const sorted = [...ids].sort((x, y) => {
    const a = overall.get(x) as Tally
    const b = overall.get(y) as Tally
    const ha = h2h.get(x) as { points: number; set_diff: number; game_diff: number }
    const hb = h2h.get(y) as { points: number; set_diff: number; game_diff: number }
    return (
      pointsOf(y) - pointsOf(x) ||
      hb.points - ha.points ||
      hb.set_diff - ha.set_diff ||
      hb.game_diff - ha.game_diff ||
      b.sets_won - b.sets_lost - (a.sets_won - a.sets_lost) ||
      b.games_won - b.games_lost - (a.games_won - a.games_lost) ||
      b.games_won - a.games_won ||
      (seedOf.get(x) ?? Number.MAX_SAFE_INTEGER) - (seedOf.get(y) ?? Number.MAX_SAFE_INTEGER) ||
      (x < y ? -1 : x > y ? 1 : 0)
    )
  })

  return sorted.map((id, i) => {
    const t = overall.get(id) as Tally
    return {
      team_id: id,
      position: i + 1,
      played: t.played,
      wins: t.wins,
      losses: t.losses,
      points: pointsOf(id),
      sets_won: t.sets_won,
      sets_lost: t.sets_lost,
      set_diff: t.sets_won - t.sets_lost,
      games_won: t.games_won,
      games_lost: t.games_lost,
      game_diff: t.games_won - t.games_lost,
    }
  })
}

// ---- Standings: elimination -------------------------------------------------------------------------

export interface EliminationRow {
  team_id: string
  /** Final placement once the team is out or champion (ties share it: two semifinal losers are both 3); null while alive. */
  placement: number | null
  status: 'champion' | 'eliminated' | 'active'
  eliminated_in: { stage: MatchStage; round: number } | null
  wins: number
  losses: number
}

/**
 * Final placement as the bracket resolves. A team is eliminated by losing a
 * match that has no loser link (any match of a single elimination; the losers
 * bracket and the grand final of a double one). Teams eliminated in the same
 * round share the placement: `1 + teams still alive + teams that lasted longer`
 * (8 teams: champion 1, finalist 2, semifinal losers 3, quarterfinal losers 5).
 */
export function eliminationStandings(teams: TeamRef[], matches: BracketMatch[]): EliminationRow[] {
  const maxLosers = Math.max(0, ...matches.filter((m) => m.stage === 'losers').map((m) => m.round))
  const stageKey = (m: BracketMatch): number => {
    if (m.stage === 'grand_final') return maxLosers + 1
    return m.round
  }

  const rows = new Map<string, EliminationRow & { key: number | null }>(
    teams.map((t) => [
      t.id,
      { team_id: t.id, placement: null, status: 'active', eliminated_in: null, wins: 0, losses: 0, key: null },
    ]),
  )

  // The final is the match nobody follows.
  const final = matches.find((m) => !m.next_match_id && m.stage !== 'losers' && m.stage !== 'winners') ??
    matches.find((m) => !m.next_match_id)

  for (const m of matches) {
    if (m.status !== 'completed' || !m.winner_team_id || !m.team1_id || !m.team2_id) continue
    const winner = rows.get(m.winner_team_id)
    const loserId = m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id
    const loser = rows.get(loserId)
    if (winner) winner.wins++
    if (loser) {
      loser.losses++
      if (!m.loser_next_match_id) {
        loser.key = stageKey(m)
        loser.status = 'eliminated'
        loser.eliminated_in = { stage: m.stage, round: m.round }
      }
    }
    if (final && m.id === final.id && winner) {
      winner.status = 'champion'
      winner.key = Number.MAX_SAFE_INTEGER
    }
  }

  const list = [...rows.values()]
  const alive = list.filter((r) => r.status === 'active').length
  for (const r of list) {
    if (r.key === null) continue
    const better = list.filter((o) => o.key !== null && (o.key as number) > (r.key as number)).length
    r.placement = 1 + alive + better
  }
  return list.map(({ key: _key, ...row }) => row)
}

// ---- Standings: americano ------------------------------------------------------------------------------

export interface AmericanoRow {
  player_id: string
  position: number
  played: number
  wins: number
  draws: number
  losses: number
  points_for: number
  points_against: number
  point_diff: number
}

export interface AmericanoMatchLite {
  status: string
  team1_players: string[] | null
  team2_players: string[] | null
  score_team1: number[] | null
  score_team2: number[] | null
}

/**
 * Individual table. Each player gets, per match, the points their side scored
 * (`score_team1[0]` / `score_team2[0]`). Ranking: total points scored, then
 * wins, then point difference, then fewer matches played is NOT used (resting
 * is part of the format), then player id (deterministic).
 */
export function americanoStandings(playerIds: string[], matches: AmericanoMatchLite[]): AmericanoRow[] {
  const rows = new Map<string, Omit<AmericanoRow, 'position' | 'point_diff'>>(
    playerIds.map((id) => [
      id,
      { player_id: id, played: 0, wins: 0, draws: 0, losses: 0, points_for: 0, points_against: 0 },
    ]),
  )
  for (const m of matches) {
    if (m.status !== 'completed' || !m.team1_players || !m.team2_players) continue
    const s1 = (m.score_team1 ?? [])[0] ?? 0
    const s2 = (m.score_team2 ?? [])[0] ?? 0
    const apply = (players: string[], mine: number, theirs: number) => {
      for (const p of players) {
        const r = rows.get(p)
        if (!r) continue
        r.played++
        r.points_for += mine
        r.points_against += theirs
        if (mine > theirs) r.wins++
        else if (mine < theirs) r.losses++
        else r.draws++
      }
    }
    apply(m.team1_players, s1, s2)
    apply(m.team2_players, s2, s1)
  }
  return [...rows.values()]
    .sort(
      (a, b) =>
        b.points_for - a.points_for ||
        b.wins - a.wins ||
        b.points_for - b.points_against - (a.points_for - a.points_against) ||
        (a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0),
    )
    .map((r, i) => ({ ...r, position: i + 1, point_diff: r.points_for - r.points_against }))
}
