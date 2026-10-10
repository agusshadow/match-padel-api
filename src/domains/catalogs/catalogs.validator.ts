import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'

// ---- Shared pieces ---------------------------------------------------------

/** Stable identity key: lowercase snake_case. Immutable once created. */
export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, 'code must be lowercase snake_case (a-z, 0-9, _)')

const nameSchema = z.string().trim().min(2).max(80)
const descriptionSchema = z.string().trim().min(2).max(300)
const imageUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .url()
  .refine((value) => value.startsWith('https://'), 'must be an https URL')
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** Either an icon key the player app knows ("trophy") or an https image URL. */
const iconSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (value) => (/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(value) && value.length <= 40) || isHttpsUrl(value),
    'must be an icon key (lowercase, e.g. "trophy") or an https URL',
  )

const MAX_AMOUNT = 1_000_000

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

export const idParamsSchema = z.object({ id: z.string().uuid() })

const listBase = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  is_active: booleanQuery.optional(),
})

/** At least one field, and `code` is rejected with a clear message. */
function patchOf<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({
      ...shape,
      code: z.never({ message: 'code cannot be changed after creation' }).optional(),
      is_active: z
        .never({ message: 'use POST /:id/activate or /:id/deactivate to change is_active' })
        .optional(),
    })
    .strict()
    .refine(
      (body) => Object.values(body).some((value) => value !== undefined),
      'at least one field is required',
    )
}

// ---- Achievements ----------------------------------------------------------

export const ACHIEVEMENT_CONDITION_TYPES = ['matches_played', 'wins'] as const

/** What accept_match_score understands. Anything else would never be awarded. */
export const achievementConditionSchema = z
  .object({
    type: z.enum(ACHIEVEMENT_CONDITION_TYPES),
    count: z.number().int().min(1).max(100_000),
  })
  .strict()
export type AchievementCondition = z.infer<typeof achievementConditionSchema>

export const listAchievementsQuerySchema = listBase
export type ListAchievementsQuery = z.infer<typeof listAchievementsQuerySchema>

export const createAchievementSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: descriptionSchema,
    icon: iconSchema,
    points: z.number().int().min(0).max(100_000).default(0),
    condition: achievementConditionSchema,
    is_active: z.boolean().default(true),
  })
  .strict()
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>

export const updateAchievementSchema = patchOf({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  icon: iconSchema.optional(),
  points: z.number().int().min(0).max(100_000).optional(),
  condition: achievementConditionSchema.optional(),
})
export type UpdateAchievementInput = z.infer<typeof updateAchievementSchema>

// ---- Challenges ------------------------------------------------------------

export const CHALLENGE_CADENCES = ['daily', 'weekly', 'monthly', 'one_time'] as const
export const CHALLENGE_ACTIONS = ['play_matches', 'win_matches'] as const

export const listChallengesQuerySchema = listBase.extend({
  cadence: z.enum(CHALLENGE_CADENCES).optional(),
  action_type: z.enum(CHALLENGE_ACTIONS).optional(),
})
export type ListChallengesQuery = z.infer<typeof listChallengesQuerySchema>

export const createChallengeSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: descriptionSchema,
    cadence: z.enum(CHALLENGE_CADENCES),
    action_type: z.enum(CHALLENGE_ACTIONS),
    target_count: z.number().int().min(1).max(10_000),
    reward_xp: z.number().int().min(0).max(100_000).default(0),
    reward_currency: z.number().int().min(0).max(MAX_AMOUNT).default(0),
    is_active: z.boolean().default(true),
  })
  .strict()
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>

export const updateChallengeSchema = patchOf({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  cadence: z.enum(CHALLENGE_CADENCES).optional(),
  action_type: z.enum(CHALLENGE_ACTIONS).optional(),
  target_count: z.number().int().min(1).max(10_000).optional(),
  reward_xp: z.number().int().min(0).max(100_000).optional(),
  reward_currency: z.number().int().min(0).max(MAX_AMOUNT).optional(),
})
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>

// ---- Cosmetics -------------------------------------------------------------

export const COSMETIC_TYPES = ['palette_skin', 'avatar', 'emblem'] as const

export const listCosmeticsQuerySchema = listBase.extend({
  type: z.enum(COSMETIC_TYPES).optional(),
})
export type ListCosmeticsQuery = z.infer<typeof listCosmeticsQuerySchema>

export const createCosmeticSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: descriptionSchema,
    type: z.enum(COSMETIC_TYPES),
    image_url: imageUrlSchema,
    price_currency: z.number().int().min(0).max(MAX_AMOUNT),
    is_active: z.boolean().default(true),
  })
  .strict()
export type CreateCosmeticInput = z.infer<typeof createCosmeticSchema>

export const updateCosmeticSchema = patchOf({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  type: z.enum(COSMETIC_TYPES).optional(),
  image_url: imageUrlSchema.optional(),
  price_currency: z.number().int().min(0).max(MAX_AMOUNT).optional(),
})
export type UpdateCosmeticInput = z.infer<typeof updateCosmeticSchema>
