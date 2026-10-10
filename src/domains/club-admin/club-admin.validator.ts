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

// ---- Card #70: schedules, exceptions and price rules ------------------------

const OPEN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
/** `24:00` means midnight (close of the day). */
const CLOSE_TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const dateSchema = z
  .string()
  .regex(DATE_PATTERN, 'date must be YYYY-MM-DD')
  .refine(isRealDate, { message: 'date is not a valid calendar date' })

const dayOfWeekSchema = z.number().int().min(0).max(6)
const slotMinutesSchema = z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)])

export const courtScheduleParamsSchema = z.object({
  clubId: z.string().uuid(),
  courtId: z.string().uuid(),
})

export const scheduleIntervalSchema = z
  .object({
    /** 0 = Sunday ... 6 = Saturday */
    day_of_week: dayOfWeekSchema,
    open_time: z.string().regex(OPEN_TIME_PATTERN, 'open_time must be HH:MM'),
    close_time: z.string().regex(CLOSE_TIME_PATTERN, 'close_time must be HH:MM (24:00 allowed)'),
    slot_minutes: slotMinutesSchema.default(60),
  })
  .strict()

export const replaceScheduleSchema = z
  .object({ intervals: z.array(scheduleIntervalSchema).max(28) })
  .strict()
export type ReplaceScheduleInput = z.infer<typeof replaceScheduleSchema>

export const createExceptionSchema = z
  .object({
    date: dateSchema,
    /** Inclusive end of a range; one exception row is created per day. */
    date_to: dateSchema.optional(),
    /** Omitted or null = the whole club. */
    court_id: z.string().uuid().nullable().optional(),
    closed: z.boolean().default(true),
    open_time: z.string().regex(OPEN_TIME_PATTERN, 'open_time must be HH:MM').optional(),
    close_time: z.string().regex(CLOSE_TIME_PATTERN, 'close_time must be HH:MM (24:00 allowed)').optional(),
    slot_minutes: slotMinutesSchema.optional(),
    reason: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.date_to !== undefined && v.date_to < v.date) {
      ctx.addIssue({ code: 'custom', path: ['date_to'], message: 'date_to must not be before date' })
    }
    if (!v.closed) {
      if (v.open_time === undefined || v.close_time === undefined) {
        ctx.addIssue({ code: 'custom', path: ['open_time'], message: 'open_time and close_time are required when closed is false' })
      } else if (v.open_time >= v.close_time) {
        ctx.addIssue({ code: 'custom', path: ['close_time'], message: 'open_time must be before close_time' })
      }
    } else if (v.open_time !== undefined || v.close_time !== undefined || v.slot_minutes !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['closed'], message: 'open_time, close_time and slot_minutes only apply when closed is false' })
    }
  })
export type CreateExceptionInput = z.infer<typeof createExceptionSchema>

export const listExceptionsQuerySchema = z.object({
  court_id: z.string().uuid().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})
export type ListExceptionsQuery = z.infer<typeof listExceptionsQuerySchema>

export const exceptionParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

export const priceRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    days_of_week: z
      .array(dayOfWeekSchema)
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, { message: 'days_of_week must not repeat days' }),
    start_time: z.string().regex(OPEN_TIME_PATTERN, 'start_time must be HH:MM'),
    end_time: z.string().regex(CLOSE_TIME_PATTERN, 'end_time must be HH:MM (24:00 allowed)'),
    price_per_hour: z.number().positive().max(10_000_000),
    priority: z.number().int().min(-100).max(100).default(0),
    is_active: z.boolean().default(true),
  })
  .strict()
  .refine((r) => r.start_time < r.end_time, { message: 'start_time must be before end_time', path: ['end_time'] })

export const replacePriceRulesSchema = z.object({ rules: z.array(priceRuleSchema).max(30) }).strict()
export type ReplacePriceRulesInput = z.infer<typeof replacePriceRulesSchema>

export const previewQuerySchema = z.object({ date: dateSchema })
export type PreviewQuery = z.infer<typeof previewQuerySchema>

// ---- Card #71: calendar, blocks, move and cancel ----------------------------

const isoInstantSchema = z.string().datetime({ offset: true, message: 'must be an ISO 8601 instant, e.g. 2026-10-12T00:00:00-03:00' })

export const MAX_CALENDAR_DAYS = 14
const MS_PER_DAY = 86_400_000

export const calendarQuerySchema = z
  .object({
    from: isoInstantSchema,
    to: isoInstantSchema,
    /** `courtId` as in the card; `court_id` is accepted like the other club-admin queries. */
    courtId: z.string().uuid().optional(),
    court_id: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    const from = new Date(v.from).getTime()
    const to = new Date(v.to).getTime()
    if (to <= from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must be after from' })
    } else if (to - from > MAX_CALENDAR_DAYS * MS_PER_DAY) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `The range can be at most ${MAX_CALENDAR_DAYS} days` })
    }
  })
export type CalendarQuery = z.infer<typeof calendarQuerySchema>

export const moveReservationSchema = z
  .object({
    /** Omitted = same court. */
    court_id: z.string().uuid().optional(),
    start_time: isoInstantSchema,
    end_time: isoInstantSchema,
  })
  .strict()
  .refine((v) => new Date(v.end_time).getTime() > new Date(v.start_time).getTime(), {
    message: 'end_time must be after start_time',
    path: ['end_time'],
  })
export type MoveReservationInput = z.infer<typeof moveReservationSchema>

export const cancelReservationSchema = z
  .object({ reason: z.string().trim().max(300).nullable().optional() })
  .strict()
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>

export const MAX_BLOCK_DAYS = 365

export const createBlocksSchema = z
  .object({
    court_ids: z.array(z.string().uuid()).min(1).max(50),
    start_time: isoInstantSchema,
    end_time: isoInstantSchema,
    reason: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const start = new Date(v.start_time).getTime()
    const end = new Date(v.end_time).getTime()
    if (end <= start) {
      ctx.addIssue({ code: 'custom', path: ['end_time'], message: 'end_time must be after start_time' })
    } else if (end - start > MAX_BLOCK_DAYS * MS_PER_DAY) {
      ctx.addIssue({ code: 'custom', path: ['end_time'], message: `A block can last at most ${MAX_BLOCK_DAYS} days` })
    }
    if (new Set(v.court_ids).size !== v.court_ids.length) {
      ctx.addIssue({ code: 'custom', path: ['court_ids'], message: 'court_ids must not repeat a court' })
    }
  })
export type CreateBlocksInput = z.infer<typeof createBlocksSchema>

export const listBlocksQuerySchema = z.object({
  from: isoInstantSchema.optional(),
  to: isoInstantSchema.optional(),
  court_id: z.string().uuid().optional(),
})
export type ListBlocksQuery = z.infer<typeof listBlocksQuerySchema>

export const blockParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})
