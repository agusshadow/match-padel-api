// Card #77: fixture generation for the four tournament formats. Pure functions
// (no database, no clock, no randomness) so they can be checked on their own.
// Algorithms and rules: docs/tournaments.md.
//
// Every generator returns plain `FixtureMatch` rows with local string keys; the
// service persists them and maps the keys to uuids. Teams are given best seed
// first (index 0 = seed 1).

export type TournamentFormat = 'round_robin' | 'single_elimination' | 'double_elimination' | 'americano'

export type MatchStage = 'group' | 'main' | 'winners' | 'losers' | 'grand_final' | 'americano'

export interface FixtureLink {
  key: string
  slot: 1 | 2
}

export interface FixtureMatch {
  /** Unique local key (`<stage>:<round>:<position>`). */
  key: string
  stage: MatchStage
  /** 1-based. */
  round: number
  /** 0-based inside (stage, round). */
  position: number
  /** Team assigned from the start (round 1 / round robin); null where the slot is fed by another match or empty (a bye). */
  team1_id: string | null
  team2_id: string | null
  /** Americano only: the two players of each side. */
  team1_players: [string, string] | null
  team2_players: [string, string] | null
  /** Where the winner goes. */
  next: FixtureLink | null
  /** Where the loser goes (double elimination only). */
  loser_next: FixtureLink | null
}

export class FixtureError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = 'FixtureError'
  }
}

export const MIN_TEAMS: Record<TournamentFormat, number> = {
  round_robin: 2,
  single_elimination: 2,
  double_elimination: 3,
  // Americano counts registrations (pairs): 2 registrations = 4 players = one court.
  americano: 2,
}

export const MAX_FIXTURE_TEAMS = 64

/** Moves the last element to the front (the circle method's rotation). */
function rotateRight<T>(items: T[]): void {
  if (items.length > 1) items.unshift(items.pop() as T)
}

function keyOf(stage: MatchStage, round: number, position: number): string {
  return `${stage}:${round}:${position}`
}

function nextPowerOfTwo(n: number): number {
  let s = 1
  while (s < n) s *= 2
  return s
}

function log2(n: number): number {
  return Math.round(Math.log2(n))
}

function emptyMatch(stage: MatchStage, round: number, position: number): FixtureMatch {
  return {
    key: keyOf(stage, round, position),
    stage,
    round,
    position,
    team1_id: null,
    team2_id: null,
    team1_players: null,
    team2_players: null,
    next: null,
    loser_next: null,
  }
}

function assertTeams(format: TournamentFormat, ids: string[]): void {
  if (new Set(ids).size !== ids.length) throw new FixtureError('Duplicate teams', 'DUPLICATE_TEAMS')
  if (ids.length < MIN_TEAMS[format]) {
    throw new FixtureError(`At least ${MIN_TEAMS[format]} teams are needed`, 'NOT_ENOUGH_TEAMS')
  }
  if (ids.length > MAX_FIXTURE_TEAMS) {
    throw new FixtureError(`At most ${MAX_FIXTURE_TEAMS} teams are supported`, 'TOO_MANY_TEAMS')
  }
}

// ---- Round robin ---------------------------------------------------------------------

/**
 * Circle method. With an odd number of teams a phantom opponent is added: the
 * team that draws it rests that round (no row is stored for a rest). N teams
 * (N even) play N-1 rounds of N/2 matches, N odd plays N rounds of (N-1)/2;
 * every pair meets exactly once.
 */
export function generateRoundRobin(teamIds: string[]): FixtureMatch[] {
  assertTeams('round_robin', teamIds)
  const slots: Array<string | null> = [...teamIds]
  if (slots.length % 2 === 1) slots.push(null)
  const n = slots.length
  const rounds = n - 1
  const out: FixtureMatch[] = []

  const rotating = slots.slice(1)
  for (let r = 0; r < rounds; r++) {
    const order = [slots[0], ...rotating]
    let position = 0
    for (let i = 0; i < n / 2; i++) {
      const a = order[i]
      const b = order[n - 1 - i]
      if (a === null || b === null) continue
      // Alternate the sides so nobody is always team 1.
      const swap = (r + i) % 2 === 1
      const m = emptyMatch('group', r + 1, position++)
      m.team1_id = swap ? b : a
      m.team2_id = swap ? a : b
      out.push(m)
    }
    rotateRight(rotating)
  }
  return out
}

// ---- Single elimination -----------------------------------------------------------------

/** Seed numbers (1-based) in bracket order for a bracket of `size` (power of two): 1 meets `size`, 2 meets `size-1`, ... */
export function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const s = order.length * 2
    order = order.flatMap((x) => [x, s + 1 - x])
  }
  return order
}

/**
 * Seeded bracket padded to a power of two. The top `size - N` seeds get a bye
 * (their round 1 opponent slot stays empty and the resolver advances them).
 */
export function generateSingleElimination(teamIds: string[]): FixtureMatch[] {
  assertTeams('single_elimination', teamIds)
  return buildWinnersBracket(teamIds, 'main')
}

function buildWinnersBracket(teamIds: string[], stage: 'main' | 'winners'): FixtureMatch[] {
  const size = nextPowerOfTwo(teamIds.length)
  const rounds = log2(size)
  const order = seedOrder(size)
  const matches: FixtureMatch[] = []

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r
    for (let p = 0; p < count; p++) {
      const m = emptyMatch(stage, r, p)
      if (r === 1) {
        const s1 = order[2 * p]
        const s2 = order[2 * p + 1]
        m.team1_id = s1 <= teamIds.length ? teamIds[s1 - 1] : null
        m.team2_id = s2 <= teamIds.length ? teamIds[s2 - 1] : null
      }
      if (r < rounds) {
        m.next = { key: keyOf(stage, r + 1, Math.floor(p / 2)), slot: (p % 2 === 0 ? 1 : 2) as 1 | 2 }
      }
      matches.push(m)
    }
  }
  return matches
}

// ---- Double elimination -------------------------------------------------------------------

/**
 * Winners bracket (as single elimination), losers bracket and one grand final.
 *
 * Losers bracket of a size-S bracket (k = log2 S winners rounds) has 2(k-1)
 * rounds: round 2i-1 pairs the survivors of the previous losers round (round 1:
 * the losers of winners round 1) and round 2i receives the losers of winners
 * round i+1 against them. Drop-ins are reversed to avoid immediate rematches.
 * The grand final is a SINGLE match: winners champion vs losers champion, with no
 * "bracket reset" (documented in docs/tournaments.md).
 */
export function generateDoubleElimination(teamIds: string[]): FixtureMatch[] {
  assertTeams('double_elimination', teamIds)
  const size = nextPowerOfTwo(teamIds.length)
  const k = log2(size)
  const winners = buildWinnersBracket(teamIds, 'winners')
  const byKey = new Map(winners.map((m) => [m.key, m]))
  const losers: FixtureMatch[] = []

  const lbRounds = 2 * (k - 1)
  const lbCount = (round: number) => size / 2 ** (Math.floor((round + 1) / 2) + 1)

  for (let j = 1; j <= lbRounds; j++) {
    const count = lbCount(j)
    for (let p = 0; p < count; p++) {
      const m = emptyMatch('losers', j, p)
      if (j < lbRounds) {
        if (j % 2 === 1) {
          // Odd round -> the even round that follows takes the winner in slot 1, same index.
          m.next = { key: keyOf('losers', j + 1, p), slot: 1 }
        } else {
          // Even round -> pairs up in the next odd round.
          m.next = { key: keyOf('losers', j + 1, Math.floor(p / 2)), slot: (p % 2 === 0 ? 1 : 2) as 1 | 2 }
        }
      } else {
        m.next = { key: keyOf('grand_final', 1, 0), slot: 2 }
      }
      losers.push(m)
    }
  }

  // Losers of the winners bracket drop into the losers bracket.
  for (const w of winners) {
    if (w.round === 1) {
      w.loser_next = { key: keyOf('losers', 1, Math.floor(w.position / 2)), slot: (w.position % 2 === 0 ? 1 : 2) as 1 | 2 }
    } else {
      const lbRound = 2 * (w.round - 1)
      const count = lbCount(lbRound)
      w.loser_next = { key: keyOf('losers', lbRound, count - 1 - w.position), slot: 2 }
    }
  }

  const final = byKey.get(keyOf('winners', k, 0))
  const grand = emptyMatch('grand_final', 1, 0)
  if (final) final.next = { key: grand.key, slot: 1 }

  return [...winners, ...losers, grand]
}

// ---- Americano -------------------------------------------------------------------------------

export interface AmericanoOptions {
  /** Rounds to play. Default and maximum: a full rotation (every pair of players partners once). */
  rounds?: number
}

export const AMERICANO_MIN_PLAYERS = 4
const AMERICANO_BEAM_WIDTH = 64

/**
 * Rotating partners. Individual players, circle method: with N players (a
 * phantom is added when N is odd) N' = N or N+1, round r pairs the players
 * with the circle rotation, so over N'-1 rounds EVERY player partners EVERY
 * other player exactly once. The pairs of a round are matched two against two
 * (one court = 4 players). A player paired with the phantom rests, and when the
 * number of real pairs is odd one pair sits out: which one is chosen by a small
 * deterministic beam search over the rounds that minimizes the sum of squared
 * rests per player (keeps the matches played per player as even as possible).
 */
export function generateAmericano(playerIds: string[], options: AmericanoOptions = {}): FixtureMatch[] {
  if (new Set(playerIds).size !== playerIds.length) throw new FixtureError('Duplicate players', 'DUPLICATE_TEAMS')
  if (playerIds.length < AMERICANO_MIN_PLAYERS) {
    throw new FixtureError(`At least ${AMERICANO_MIN_PLAYERS} players are needed`, 'NOT_ENOUGH_TEAMS')
  }
  if (playerIds.length > MAX_FIXTURE_TEAMS * 2) throw new FixtureError('Too many players', 'TOO_MANY_TEAMS')

  const slots: Array<string | null> = [...playerIds]
  if (slots.length % 2 === 1) slots.push(null)
  const n = slots.length
  const fullRotation = n - 1
  const rounds = Math.min(options.rounds ?? fullRotation, fullRotation)
  if (rounds < 1) throw new FixtureError('At least one round is needed', 'INVALID_ROUNDS')

  // 1. The circle method fixes who partners whom each round.
  const rotating = slots.slice(1)
  const roundPairs: Array<Array<[string, string]>> = []
  const roundRester: Array<string | null> = []
  for (let r = 0; r < rounds; r++) {
    const order = [slots[0], ...rotating]
    const pairs: Array<[string, string]> = []
    let rester: string | null = null
    for (let i = 0; i < n / 2; i++) {
      const a = order[i]
      const b = order[n - 1 - i]
      if (a === null || b === null) rester = (a ?? b) as string
      else pairs.push([a, b])
    }
    roundPairs.push(pairs)
    roundRester.push(rester)
    rotateRight(rotating)
  }

  // 2. When a round has an odd number of pairs one of them sits out. Choosing
  //    which one is a small search over the rounds (beam search, deterministic)
  //    that keeps the number of rests per player as even as possible.
  const index = new Map(playerIds.map((p, i) => [p, i]))
  type State = { rests: number[]; sits: number[]; score: number }
  let beam: State[] = [{ rests: playerIds.map(() => 0), sits: [], score: 0 }]
  for (let r = 0; r < rounds; r++) {
    const pairs = roundPairs[r]
    const rester = roundRester[r]
    const next: State[] = []
    for (const state of beam) {
      const base = state.rests.slice()
      if (rester !== null) base[index.get(rester) as number] += 1
      const options = pairs.length % 2 === 1 ? pairs.map((_, i) => i) : [-1]
      for (const sit of options) {
        const rests = base.slice()
        if (sit >= 0) for (const pl of pairs[sit]) rests[index.get(pl) as number] += 1
        let score = 0
        for (const v of rests) score += v * v
        next.push({ rests, sits: [...state.sits, sit], score })
      }
    }
    // Stable sort: ties keep the lower pair index first.
    next.sort((a, b) => a.score - b.score)
    beam = next.slice(0, AMERICANO_BEAM_WIDTH)
  }
  const sits = beam[0].sits

  // 3. Build the matches.
  const out: FixtureMatch[] = []
  for (let r = 0; r < rounds; r++) {
    const pairs = roundPairs[r].filter((_, i) => i !== sits[r])
    // Rotate which pairs meet from one round to the next so opponents vary.
    const shift = pairs.length > 2 ? r % pairs.length : 0
    const arranged = [...pairs.slice(shift), ...pairs.slice(0, shift)]
    for (let i = 0; i + 1 < arranged.length; i += 2) {
      const m = emptyMatch('americano', r + 1, i / 2)
      m.team1_players = arranged[i]
      m.team2_players = arranged[i + 1]
      out.push(m)
    }
  }
  return out
}

// ---- Dispatcher ----------------------------------------------------------------------------------

/** Builds the fixture of a format. `teamIdsBestSeedFirst` are registrations; americano takes individual players. */
export function generateFixture(
  format: TournamentFormat,
  teamIdsBestSeedFirst: string[],
  options: { americano?: AmericanoOptions; playersBestSeedFirst?: string[] } = {},
): FixtureMatch[] {
  switch (format) {
    case 'round_robin':
      return generateRoundRobin(teamIdsBestSeedFirst)
    case 'single_elimination':
      return generateSingleElimination(teamIdsBestSeedFirst)
    case 'double_elimination':
      return generateDoubleElimination(teamIdsBestSeedFirst)
    case 'americano':
      return generateAmericano(options.playersBestSeedFirst ?? [], options.americano)
  }
}
