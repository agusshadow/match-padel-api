import { z } from 'zod'

export const CreateMatchSchema = z.object({
  type: z.enum(['friendly', 'ranked', 'tournament']),
  is_ranked: z.boolean().default(false),
  court_id: z.string().uuid('Invalid court_id'),
  start_time: z.string().datetime('start_time must be ISO 8601 datetime'),
  end_time: z.string().datetime('end_time must be ISO 8601 datetime'),
})

export const SubmitScoreSchema = z.object({
  score_team1: z.array(z.number().int().min(0)).min(1),
  score_team2: z.array(z.number().int().min(0)).min(1),
})

export type CreateMatchRequest = z.infer<typeof CreateMatchSchema>
export type SubmitScoreRequest = z.infer<typeof SubmitScoreSchema>
