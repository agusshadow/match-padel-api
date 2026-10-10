import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'

export const clubParamsSchema = z.object({
  clubId: z.string().uuid(),
})

export const reservationParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

export const listReservationsQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
})
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>

export const listQuerySchema = paginationSchema
export type ListQuery = z.infer<typeof listQuerySchema>

export const updateReservationStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed']),
})
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>

export const updateClubSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullable(),
    address: z.string().trim().min(2).max(200),
    city: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().email().max(200).nullable(),
    logo_url: z.string().trim().url().max(500).nullable(),
    cover_url: z.string().trim().url().max(500).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
export type UpdateClubInput = z.infer<typeof updateClubSchema>
