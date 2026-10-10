import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'

export const tournamentFormatSchema = z.enum(['round_robin', 'single_elimination', 'double_elimination', 'americano'])
export const tournamentStatusSchema = z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled'])

export const MAX_TEAMS = 64
export const MAX_ENTRY_FEE = 1_000_000

const money = z
  .number()
  .min(0)
  .max(MAX_ENTRY_FEE)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'At most 2 decimals' })

const isoInstant = z.string().datetime({ offset: true })

const rulesSchema = z
  .object({
    /** Americano: number of rounds to play (default: a full rotation). */
    americano_rounds: z.number().int().min(1).max(63).optional(),
  })
  .passthrough()

const baseFields = {
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(2000).nullable(),
  format: tournamentFormatSchema,
  /** Registrations (pairs) for every format but americano. 2..64. */
  max_teams: z.number().int().min(2).max(MAX_TEAMS),
  /** Americano only: individual players, even, 4..128 (stored as `max_teams = max_players / 2`). */
  max_players: z.number().int().min(4).max(MAX_TEAMS * 2),
  category: z.string().trim().min(1).max(60).nullable(),
  min_elo: z.number().int().min(0).max(10000).nullable(),
  max_elo: z.number().int().min(0).max(10000).nullable(),
  entry_fee: money,
  prize_pool: money,
  rules: rulesSchema,
  start_date: isoInstant,
  end_date: isoInstant.nullable(),
  registration_deadline: isoInstant.nullable(),
}

export const createTournamentSchema = z
  .object({
    name: baseFields.name,
    description: baseFields.description.optional(),
    format: baseFields.format,
    max_teams: baseFields.max_teams.optional(),
    max_players: baseFields.max_players.optional(),
    category: baseFields.category.optional(),
    min_elo: baseFields.min_elo.optional(),
    max_elo: baseFields.max_elo.optional(),
    entry_fee: baseFields.entry_fee.default(0),
    prize_pool: baseFields.prize_pool.default(0),
    rules: baseFields.rules.optional(),
    start_date: baseFields.start_date,
    end_date: baseFields.end_date.optional(),
    registration_deadline: baseFields.registration_deadline.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.format === 'americano') {
      if (v.max_players === undefined) issue('max_players', 'max_players is required for americano')
      else if (v.max_players % 2 !== 0) issue('max_players', 'max_players must be even (players come in pairs)')
      if (v.max_teams !== undefined) issue('max_teams', 'americano is sized with max_players')
    } else {
      if (v.max_teams === undefined) issue('max_teams', 'max_teams is required')
      if (v.max_players !== undefined) issue('max_players', 'max_players is only for americano')
    }
    checkRanges(v, issue)
  })
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>

export const updateTournamentSchema = z
  .object({
    name: baseFields.name,
    description: baseFields.description,
    format: baseFields.format,
    max_teams: baseFields.max_teams,
    max_players: baseFields.max_players,
    category: baseFields.category,
    min_elo: baseFields.min_elo,
    max_elo: baseFields.max_elo,
    entry_fee: baseFields.entry_fee,
    prize_pool: baseFields.prize_pool,
    rules: baseFields.rules,
    start_date: baseFields.start_date,
    end_date: baseFields.end_date,
    registration_deadline: baseFields.registration_deadline,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>

type Ranges = {
  start_date?: string
  end_date?: string | null
  registration_deadline?: string | null
  min_elo?: number | null
  max_elo?: number | null
}

/** Cross-field rules shared by create and (on the merged row) update. */
export function checkRanges(v: Ranges, issue: (path: string, message: string) => void): void {
  const start = v.start_date ? new Date(v.start_date).getTime() : null
  if (start !== null && v.end_date && new Date(v.end_date).getTime() < start) {
    issue('end_date', 'end_date must not be before start_date')
  }
  if (start !== null && v.registration_deadline && new Date(v.registration_deadline).getTime() > start) {
    issue('registration_deadline', 'registration_deadline must not be after start_date')
  }
  if (v.min_elo != null && v.max_elo != null && v.min_elo > v.max_elo) {
    issue('min_elo', 'min_elo must not be above max_elo')
  }
}

export const tournamentParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

export const tournamentMatchParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
  matchId: z.string().uuid(),
})

export const listTournamentsQuerySchema = paginationSchema.extend({
  status: tournamentStatusSchema.optional(),
})

export const cancelTournamentSchema = z
  .object({ reason: z.string().trim().min(1).max(300).optional() })
  .strict()

export const startTournamentSchema = z
  .object({
    /** `elo` (default): best combined ELO is seed 1. `registration`: first come, first seeded. */
    seeding: z.enum(['elo', 'registration']).optional(),
    /** Americano only: rounds to generate (default: a full rotation). */
    americano_rounds: z.number().int().min(1).max(63).optional(),
  })
  .strict()

const setScore = z.number().int().min(0).max(99)

export const recordResultSchema = z
  .object({
    /** Games per set (padel), e.g. `[6, 4, 7]`; americano: a single entry, the points of the side. */
    score_team1: z.array(setScore).min(1).max(5),
    score_team2: z.array(setScore).min(1).max(5),
    /** Only needed when the score is a tie (it decides which team goes through). */
    winner: z.enum(['team1', 'team2']).optional(),
  })
  .strict()

// ---- Player side ----------------------------------------------------------------------------

export const registerTeamSchema = z.object({
  partner_id: z.string().uuid(),
  team_name: z.string().trim().min(2).max(50).optional(),
})

export const publicListQuerySchema = z.object({
  status: tournamentStatusSchema.optional(),
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
