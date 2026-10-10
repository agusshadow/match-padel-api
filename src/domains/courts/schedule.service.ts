/**
 * Effective schedule and price of a court (card #70, [Admin F2]).
 *
 * Pure module: no database, no clock, no Express. Everything that needs data
 * receives a `ScheduleContext` loaded by `court.repository.ts`. See
 * `docs/availability-and-pricing.md` for the resolution order.
 *
 * Conventions
 * - Dates are club-local calendar dates `YYYY-MM-DD`; times are club-local wall
 *   clock `HH:MM` (a `close` of `24:00` means midnight). The club timezone is
 *   America/Argentina/Buenos_Aires, UTC-3 with no daylight saving, the same
 *   fixed offset the rest of the API uses (see `clubDayBounds`).
 * - `day_of_week`: 0 = Sunday ... 6 = Saturday.
 * - Money is rounded to 2 decimals (see `slotPrice`).
 */
import { AppError } from '../../types/errors'

export const CLUB_UTC_OFFSET_MINUTES = -180
export const DEFAULT_SLOT_MINUTES = 60
export const SLOT_MINUTES_OPTIONS = [30, 60, 90, 120] as const
export const MINUTES_PER_DAY = 1440

/** Index = day_of_week (0 = Sunday). Keys of `clubs.settings.opening_hours`. */
export const OPENING_HOURS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export interface WeeklyInterval {
  day_of_week: number
  open_time: string
  close_time: string
  slot_minutes: number
}

export interface ScheduleException {
  /** null = the whole club. */
  court_id: string | null
  date: string
  closed: boolean
  open_time: string | null
  close_time: string | null
  slot_minutes: number | null
  reason: string | null
}

export interface PriceRule {
  id: string
  name: string
  days_of_week: number[]
  start_time: string
  end_time: string
  price_per_hour: number
  priority: number
  is_active: boolean
}

export type ClubOpeningHours = Partial<
  Record<(typeof OPENING_HOURS_KEYS)[number], Array<{ open: string; close: string }>>
>

export interface ScheduleContext {
  court_id: string
  /** `courts.price_per_hour`: the fallback when no price rule covers a slot. */
  base_price_per_hour: number
  /** Active court-level weekly rows. Empty = the court has no schedule of its own. */
  weekly: WeeklyInterval[]
  /** Exceptions of the court and of its club (any date; filtered by `resolveDay`). */
  exceptions: ScheduleException[]
  /** Active rules only. */
  price_rules: PriceRule[]
  /** `clubs.settings.opening_hours`, the fallback when the court has no weekly rows. */
  club_hours: ClubOpeningHours | null
}

export interface PricedSlot {
  /** UTC instants (ISO), the same format the reservations use. */
  start_time: string
  end_time: string
  /** Club-local wall clock, `HH:MM` (`24:00` possible for `end`). */
  start: string
  end: string
  slot_minutes: number
  /** Hourly rate applied to this slot (price rule at the slot start, else the court's base price). */
  price_per_hour: number
  /** Total for the whole slot: price_per_hour x slot_minutes / 60, 2 decimals. */
  price: number
  rule_id: string | null
  rule_name: string | null
}

export type DaySource = 'court_exception' | 'club_exception' | 'court_schedule' | 'club_hours' | 'none'

export interface DaySchedule {
  date: string
  day_of_week: number
  /** Where the hours (or the closure) of this day come from. */
  source: DaySource
  closed: boolean
  /** Reason of the exception when it closes the day, else null. */
  closed_reason: string | null
  slots: PricedSlot[]
}

// ---- Time helpers -------------------------------------------------------------

/** `HH:MM` or `HH:MM:SS` (also `24:00[:00]`) to minutes since local midnight. */
export function parseTime(value: string): number {
  const [h, m] = value.split(':')
  return Number(h) * 60 + Number(m)
}

/** Minutes to `HH:MM` (1440 -> `24:00`). */
export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Normalizes a database `time` (`HH:MM:SS`) to `HH:MM`. */
export function normalizeTime(value: string): string {
  return formatTime(parseTime(value))
}

/** Day of week (0 = Sunday) of a club-local calendar date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Club-local calendar date of an instant. */
export function localDateOf(instant: Date): string {
  return new Date(instant.getTime() + CLUB_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10)
}

/** The UTC instant of `minutes` after local midnight of `date` (1440 = next midnight). */
export function localInstant(date: string, minutes: number): Date {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes - CLUB_UTC_OFFSET_MINUTES))
}

// ---- Pricing ------------------------------------------------------------------

/** Total of a slot in currency units, rounded to 2 decimals (computed in cents). */
export function slotPrice(pricePerHour: number, slotMinutes: number): number {
  return Math.round((pricePerHour * 100 * slotMinutes) / 60) / 100
}

/**
 * The price rule covering a slot that starts at `startMinutes` on `dayOfWeek`:
 * active, listing the day, with start_time <= start < end_time. Among several,
 * the highest priority wins; ties go to the narrower time window, then to the
 * rule listing fewer days, then to the lowest id (deterministic).
 */
export function pickPriceRule(rules: PriceRule[], dayOfWeek: number, startMinutes: number): PriceRule | null {
  const covering = rules.filter(
    (r) =>
      r.is_active &&
      r.days_of_week.includes(dayOfWeek) &&
      parseTime(r.start_time) <= startMinutes &&
      startMinutes < parseTime(r.end_time),
  )
  if (covering.length === 0) return null
  covering.sort(
    (a, b) =>
      b.priority - a.priority ||
      parseTime(a.end_time) - parseTime(a.start_time) - (parseTime(b.end_time) - parseTime(b.start_time)) ||
      a.days_of_week.length - b.days_of_week.length ||
      a.id.localeCompare(b.id),
  )
  return covering[0]
}

// ---- Resolution ---------------------------------------------------------------

interface Window {
  open: number
  close: number
  slot: number
}

function windowsOf(
  ctx: ScheduleContext,
  date: string,
): { source: DaySource; closed: boolean; reason: string | null; windows: Window[] } {
  const dow = weekdayOf(date)
  const weeklyToday = ctx.weekly
    .filter((w) => w.day_of_week === dow)
    .map((w) => ({ open: parseTime(w.open_time), close: parseTime(w.close_time), slot: w.slot_minutes }))
    .sort((a, b) => a.open - b.open)

  // 1. Exception for that date: the court's own beats the club's.
  const exception =
    ctx.exceptions.find((e) => e.date === date && e.court_id === ctx.court_id) ??
    ctx.exceptions.find((e) => e.date === date && e.court_id === null)
  if (exception) {
    const source: DaySource = exception.court_id === null ? 'club_exception' : 'court_exception'
    if (exception.closed || exception.open_time === null || exception.close_time === null) {
      return { source, closed: true, reason: exception.reason, windows: [] }
    }
    const slot = exception.slot_minutes ?? weeklyToday[0]?.slot ?? DEFAULT_SLOT_MINUTES
    return {
      source,
      closed: false,
      reason: null,
      windows: [{ open: parseTime(exception.open_time), close: parseTime(exception.close_time), slot }],
    }
  }

  // 2. The court's own weekly schedule.
  if (ctx.weekly.length > 0) {
    return { source: 'court_schedule', closed: weeklyToday.length === 0, reason: null, windows: weeklyToday }
  }

  // 3. The club's opening hours (onboarding draft), default slot length.
  const hours = ctx.club_hours?.[OPENING_HOURS_KEYS[dow]] ?? []
  if (ctx.club_hours && hours.length > 0) {
    const windows = hours
      .map((h) => ({ open: parseTime(h.open), close: parseTime(h.close), slot: DEFAULT_SLOT_MINUTES }))
      .filter((w) => Number.isFinite(w.open) && Number.isFinite(w.close))
      .sort((a, b) => a.open - b.open)
    return { source: 'club_hours', closed: false, reason: null, windows }
  }

  return { source: ctx.club_hours ? 'club_hours' : 'none', closed: true, reason: null, windows: [] }
}

/** The priced slots a court offers on a club-local date (before reservations and the clock). */
export function resolveDay(ctx: ScheduleContext, date: string): DaySchedule {
  const dow = weekdayOf(date)
  const { source, closed, reason, windows } = windowsOf(ctx, date)

  const slots: PricedSlot[] = []
  let lastEnd = -1
  for (const w of windows) {
    for (let start = w.open; start + w.slot <= w.close; start += w.slot) {
      if (start < lastEnd) continue // overlapping rows never produce overlapping slots
      const end = start + w.slot
      const rule = pickPriceRule(ctx.price_rules, dow, start)
      const rate = rule ? rule.price_per_hour : ctx.base_price_per_hour
      slots.push({
        start_time: localInstant(date, start).toISOString(),
        end_time: localInstant(date, end).toISOString(),
        start: formatTime(start),
        end: formatTime(end),
        slot_minutes: w.slot,
        price_per_hour: rate,
        price: slotPrice(rate, w.slot),
        rule_id: rule ? rule.id : null,
        rule_name: rule ? rule.name : null,
      })
      lastEnd = end
    }
  }

  return { date, day_of_week: dow, source, closed: closed || slots.length === 0, closed_reason: reason, slots }
}

export type QuoteFailureCode = 'COURT_CLOSED' | 'OUTSIDE_SCHEDULE'

export type RangeQuote =
  | { ok: true; total_price: number; slots: PricedSlot[] }
  | { ok: false; code: QuoteFailureCode; message: string }

/**
 * Prices a requested reservation range. The range must be made of whole,
 * contiguous slots of the effective schedule (it may be several slots, e.g.
 * two hours). The total is the sum of the slot prices, so rules and rounding
 * match what the availability endpoints showed.
 */
export function quoteRange(ctx: ScheduleContext, startIso: string, endIso: string): RangeQuote {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const firstDate = localDateOf(start)
  const lastDate = localDateOf(new Date(end.getTime() - 1))

  const days: DaySchedule[] = []
  for (let date = firstDate, i = 0; date <= lastDate && i < 3; date = addDays(date, 1), i++) {
    days.push(resolveDay(ctx, date))
  }

  const first = days[0]
  if (first && first.closed && (first.source === 'court_exception' || first.source === 'club_exception')) {
    const why = first.closed_reason ? `: ${first.closed_reason}` : ''
    return { ok: false, code: 'COURT_CLOSED', message: `The court is closed on that date${why}` }
  }

  const byStart = new Map<number, PricedSlot>()
  for (const day of days) for (const slot of day.slots) byStart.set(new Date(slot.start_time).getTime(), slot)

  const used: PricedSlot[] = []
  let cursor = start.getTime()
  let cents = 0
  while (cursor < end.getTime()) {
    const slot = byStart.get(cursor)
    if (!slot) {
      return {
        ok: false,
        code: 'OUTSIDE_SCHEDULE',
        message: 'The requested time is outside the court schedule (it must match whole slots)',
      }
    }
    used.push(slot)
    cents += Math.round(slot.price * 100)
    cursor = new Date(slot.end_time).getTime()
  }
  if (cursor !== end.getTime() || used.length === 0) {
    return {
      ok: false,
      code: 'OUTSIDE_SCHEDULE',
      message: 'The requested time is outside the court schedule (it must match whole slots)',
    }
  }
  return { ok: true, total_price: cents / 100, slots: used }
}

/** Same as `quoteRange` but throws a 409 `AppError` carrying the failure code. */
export function quoteRangeOrThrow(
  ctx: ScheduleContext,
  startIso: string,
  endIso: string,
): { total_price: number; slots: PricedSlot[] } {
  const quote = quoteRange(ctx, startIso, endIso)
  if (!quote.ok) throw new AppError(quote.message, 409, quote.code)
  return { total_price: quote.total_price, slots: quote.slots }
}

// ---- Write-time validation (used by the club panel endpoints) --------------------

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Human-readable problems of a weekly schedule; empty when valid. */
export function validateWeeklyIntervals(intervals: WeeklyInterval[]): string[] {
  const errors: string[] = []
  for (const iv of intervals) {
    const open = parseTime(iv.open_time)
    const close = parseTime(iv.close_time)
    if (open >= close) errors.push(`day ${iv.day_of_week}: open_time ${iv.open_time} must be before close_time ${iv.close_time}`)
    else if (close - open < iv.slot_minutes) {
      errors.push(`day ${iv.day_of_week}: ${iv.open_time}-${iv.close_time} is shorter than one ${iv.slot_minutes} minute slot`)
    }
  }
  for (let day = 0; day <= 6; day++) {
    const today = intervals
      .filter((iv) => iv.day_of_week === day)
      .map((iv) => ({ open: parseTime(iv.open_time), close: parseTime(iv.close_time), iv }))
      .sort((a, b) => a.open - b.open)
    for (let i = 1; i < today.length; i++) {
      if (overlaps(today[i - 1].open, today[i - 1].close, today[i].open, today[i].close)) {
        errors.push(
          `day ${day}: ${today[i - 1].iv.open_time}-${today[i - 1].iv.close_time} overlaps ${today[i].iv.open_time}-${today[i].iv.close_time}`,
        )
      }
    }
  }
  return errors
}

export interface RuleInput {
  name: string
  days_of_week: number[]
  start_time: string
  end_time: string
  price_per_hour: number
  priority: number
  is_active: boolean
}

/**
 * Pairs of active rules that would tie: same priority, a common day and
 * overlapping time windows. Different priorities may overlap (priority decides).
 */
export function findAmbiguousRules(rules: RuleInput[]): string[] {
  const problems: string[] = []
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]
      const b = rules[j]
      if (!a.is_active || !b.is_active || a.priority !== b.priority) continue
      const sharedDay = a.days_of_week.some((d) => b.days_of_week.includes(d))
      if (
        sharedDay &&
        overlaps(parseTime(a.start_time), parseTime(a.end_time), parseTime(b.start_time), parseTime(b.end_time))
      ) {
        problems.push(`"${a.name}" and "${b.name}" overlap with the same priority (${a.priority}); give them different priorities`)
      }
    }
  }
  return problems
}
