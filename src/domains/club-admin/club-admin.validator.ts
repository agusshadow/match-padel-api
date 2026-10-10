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

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const intervalSchema = z
  .object({
    open: z.string().regex(TIME_PATTERN, 'open must be HH:MM'),
    close: z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/, 'close must be HH:MM'),
  })
  .strict()
  .refine((v) => v.open < v.close, { message: 'open must be before close' })

/**
 * Weekly schedule draft stored in clubs.settings.opening_hours (card #67).
 * Keys are days; a day with no key (or an empty array) is closed. F2 replaces
 * this with a proper per-court schedule model.
 */
export const OPENING_HOURS_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const dayIntervalsSchema = z.array(intervalSchema).max(4)
export const openingHoursSchema = z
  .object({
    mon: dayIntervalsSchema,
    tue: dayIntervalsSchema,
    wed: dayIntervalsSchema,
    thu: dayIntervalsSchema,
    fri: dayIntervalsSchema,
    sat: dayIntervalsSchema,
    sun: dayIntervalsSchema,
  })
  .partial()
  .strict()
export type OpeningHours = z.infer<typeof openingHoursSchema>

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
    // Card #67 (application data)
    legal_name: z.string().trim().min(2).max(200).nullable(),
    tax_id: z.string().trim().min(2).max(40).nullable(),
    opening_hours: openingHoursSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
export type UpdateClubInput = z.infer<typeof updateClubSchema>

// ---- Card #67: onboarding ---------------------------------------------------

export const createMyClubSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(2).max(200),
    city: z.string().trim().min(2).max(100),
  })
  .strict()
export type CreateMyClubInput = z.infer<typeof createMyClubSchema>

export const COURT_SURFACES = ['indoor', 'outdoor', 'panoramic'] as const

export const courtParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

export const createCourtSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    surface: z.enum(COURT_SURFACES),
    is_indoor: z.boolean().default(true),
    price_per_hour: z.number().positive().max(10_000_000),
    is_active: z.boolean().default(true),
  })
  .strict()
export type CreateCourtInput = z.infer<typeof createCourtSchema>

export const updateCourtSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    surface: z.enum(COURT_SURFACES),
    is_indoor: z.boolean(),
    price_per_hour: z.number().positive().max(10_000_000),
    is_active: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>

export const DOCUMENT_KINDS = ['tax_id', 'company_registration', 'id_document', 'other'] as const

export const uploadDocumentBodySchema = z.object({
  kind: z.enum(DOCUMENT_KINDS).default('other'),
})
export type UploadDocumentBody = z.infer<typeof uploadDocumentBodySchema>

export const documentParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})
