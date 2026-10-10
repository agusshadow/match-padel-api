import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'

export const listQuerySchema = paginationSchema
export type ListQuery = z.infer<typeof listQuerySchema>

export const CLUB_STATUSES = [
  'draft',
  'pending',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
] as const

export const listClubsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(CLUB_STATUSES).optional(),
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

export const clubDocumentParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

// ---- Card #68: application review ------------------------------------------

export const listApplicationsQuerySchema = paginationSchema.extend({
  /** One status, or `all`. Default `pending`. A reviewer is limited to `pending` and `changes_requested`. */
  status: z.enum([...CLUB_STATUSES, 'all']).optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>

export const applicationParamsSchema = z.object({
  clubId: z.string().uuid(),
})

const noteText = z.string().trim().min(5).max(2000)

export const approveApplicationSchema = z.object({ note: noteText.optional() }).strict()
export const requestChangesSchema = z.object({ note: noteText }).strict()
export const rejectApplicationSchema = z.object({ reason: noteText }).strict()
export const suspendClubSchema = z.object({ reason: noteText }).strict()
export const unsuspendClubSchema = z.object({ note: noteText.optional() }).strict()
export const reopenClubSchema = z.object({ note: noteText.optional() }).strict()
