import { z } from 'zod'
import { paginationSchema } from '../../lib/pagination'
import { localInstant } from '../courts/schedule.service'

// Card #75: filters of the payments listings (platform and club panels).

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/**
 * `from` / `to` accept `YYYY-MM-DD` (a club-local day, Buenos Aires) or an ISO
 * 8601 instant with offset. A date-only `from` is the start of that day, a
 * date-only `to` includes that whole day; an instant `to` is exclusive.
 */
const boundary = z.string().trim().refine(
  (v) => isRealDate(v) || (/T/.test(v) && /(Z|[+-]\d{2}:?\d{2})$/.test(v) && !Number.isNaN(Date.parse(v))),
  { message: 'must be YYYY-MM-DD or an ISO 8601 instant with offset' },
)

export const paymentsFilterSchema = paginationSchema.extend({
  from: boundary.optional(),
  to: boundary.optional(),
})

export interface ResolvedRange {
  from?: Date
  /** Exclusive upper bound. */
  toExclusive?: Date
}

/** Pure: turns the raw `from`/`to` into instants. Throws nothing; see `isRangeOrdered`. */
export function resolveRange(from: string | undefined, to: string | undefined): ResolvedRange {
  const range: ResolvedRange = {}
  if (from) range.from = DATE_ONLY.test(from) ? localInstant(from, 0) : new Date(from)
  if (to) range.toExclusive = DATE_ONLY.test(to) ? localInstant(to, 1440) : new Date(to)
  return range
}

export function isRangeOrdered(range: ResolvedRange): boolean {
  return !(range.from && range.toExclusive) || range.from.getTime() < range.toExclusive.getTime()
}

export const platformPaymentsQuerySchema = paymentsFilterSchema
  .extend({ clubId: z.string().uuid().optional() })
  .superRefine((q, ctx) => {
    if (!isRangeOrdered(resolveRange(q.from, q.to))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to must be after from' })
    }
  })
export type PlatformPaymentsQuery = z.infer<typeof platformPaymentsQuerySchema>

export const clubPaymentsQuerySchema = paymentsFilterSchema.superRefine((q, ctx) => {
  if (!isRangeOrdered(resolveRange(q.from, q.to))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to must be after from' })
  }
})
export type ClubPaymentsQuery = z.infer<typeof clubPaymentsQuerySchema>

// ---- Platform: commission and collection mode -------------------------------------

export const COLLECTION_MODES = ['platform_account', 'club_account'] as const

export const setCommissionSchema = z
  .object({
    commission_percent: z
      .number()
      .min(0)
      .max(100)
      .refine((n) => Math.round(n * 100) / 100 === n, { message: 'at most 2 decimals' }),
  })
  .strict()

export const setCollectionModeSchema = z.object({ collection_mode: z.enum(COLLECTION_MODES) }).strict()

// ---- Card #76: refund policy ---------------------------------------------------------------------

const twoDecimals = (n: number) => Math.round(n * 100) / 100 === n

/** `PUT /club-admin/:clubId/refund-policy` */
export const setClubRefundPolicySchema = z
  .object({
    hours_before_start: z.number().int().min(0).max(720),
    late_refund_percent: z
      .number()
      .min(0)
      .max(100)
      .refine(twoDecimals, { message: 'at most 2 decimals' }),
  })
  .strict()

/** `PUT /platform/settings/refund-policy` */
export const setPlatformRefundLimitsSchema = z
  .object({
    max_hours_before_start: z.number().int().min(0).max(720),
    min_late_refund_percent: z
      .number()
      .min(0)
      .max(100)
      .refine(twoDecimals, { message: 'at most 2 decimals' }),
  })
  .strict()
