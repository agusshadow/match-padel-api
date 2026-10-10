import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'

export const listQuerySchema = paginationSchema
export type ListQuery = z.infer<typeof listQuerySchema>

export const listClubsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
})
export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
})
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const listAuditLogQuerySchema = paginationSchema.extend({
  clubId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
})
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>

export const createClubSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  address: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional(),
  ownerUserId: z.string().uuid().optional(),
})
export type CreateClubInput = z.infer<typeof createClubSchema>

export const clubIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const setClubActiveSchema = z.object({
  isActive: z.boolean(),
})
