import { z } from 'zod'

export const GetLeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type GetLeaderboardQuery = z.infer<typeof GetLeaderboardQuerySchema>
