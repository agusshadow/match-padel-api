import { z } from 'zod'

export const CreateReservationSchema = z.object({
  court_id: z.string().uuid('Invalid court_id'),
  start_time: z.string().datetime('start_time must be ISO 8601 datetime'),
  end_time: z.string().datetime('end_time must be ISO 8601 datetime'),
  notes: z.string().max(500).optional(),
})

export const GetSlotsSchema = z.object({
  court_id: z.string().uuid('Invalid court_id'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
})

export const GetReservationsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateReservationRequest = z.infer<typeof CreateReservationSchema>
export type GetSlotsRequest = z.infer<typeof GetSlotsSchema>
export type GetReservationsQuery = z.infer<typeof GetReservationsQuerySchema>
