import { supabase } from '../../lib/supabase'
import type {
  ClubOpeningHours,
  PriceRule,
  ScheduleContext,
  ScheduleException,
  WeeklyInterval,
} from './schedule.service'

export interface LoadContextOptions {
  courtId: string
  clubId: string
  basePricePerHour: number
  clubSettings: unknown
  /** Club-local dates (inclusive) whose exceptions are needed. */
  fromDate: string
  toDate: string
}

function openingHoursFrom(settings: unknown): ClubOpeningHours | null {
  if (!settings || typeof settings !== 'object') return null
  const hours = (settings as Record<string, unknown>)['opening_hours']
  return hours && typeof hours === 'object' ? (hours as ClubOpeningHours) : null
}

/**
 * Loads everything `schedule.service.ts` needs for one court: its weekly
 * rows, the exceptions of the court and of its club in the date range, its
 * active price rules and the club's draft opening hours.
 */
export async function loadScheduleContext(options: LoadContextOptions): Promise<ScheduleContext> {
  const { courtId, clubId } = options
  const [weekly, exceptions, rules] = await Promise.all([
    supabase
      .from('court_schedules')
      .select('day_of_week, open_time, close_time, slot_minutes')
      .eq('court_id', courtId)
      .eq('is_active', true),
    supabase
      .from('court_schedule_exceptions')
      .select('court_id, date, closed, open_time, close_time, slot_minutes, reason')
      .eq('club_id', clubId)
      .or(`court_id.is.null,court_id.eq.${courtId}`)
      .gte('date', options.fromDate)
      .lte('date', options.toDate),
    supabase
      .from('court_price_rules')
      .select('id, name, days_of_week, start_time, end_time, price_per_hour, priority, is_active')
      .eq('court_id', courtId)
      .eq('is_active', true),
  ])
  if (weekly.error) throw weekly.error
  if (exceptions.error) throw exceptions.error
  if (rules.error) throw rules.error

  return {
    court_id: courtId,
    base_price_per_hour: options.basePricePerHour,
    weekly: (weekly.data ?? []) as WeeklyInterval[],
    exceptions: (exceptions.data ?? []) as ScheduleException[],
    price_rules: ((rules.data ?? []) as Array<PriceRule & { price_per_hour: number | string }>).map((r) => ({
      ...r,
      price_per_hour: Number(r.price_per_hour),
    })),
    club_hours: openingHoursFrom(options.clubSettings),
  }
}

export interface PublicCourtContext {
  club_id: string
  context: ScheduleContext
}

/**
 * Context of a court that players can see: its club must be `approved` and
 * active (card #67). `null` when the court does not exist or is not public.
 * Like the slot endpoint always did, it does not filter on `courts.is_active`.
 */
export async function loadPublicScheduleContext(
  courtId: string,
  fromDate: string,
  toDate: string = fromDate,
): Promise<PublicCourtContext | null> {
  const { data, error } = await supabase
    .from('courts')
    .select('id, club_id, price_per_hour, club:clubs!inner(status, is_active, settings)')
    .eq('id', courtId)
    .eq('club.status', 'approved')
    .eq('club.is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as unknown as {
    club_id: string
    price_per_hour: number | string
    club: { settings: unknown }
  }
  const context = await loadScheduleContext({
    courtId,
    clubId: row.club_id,
    basePricePerHour: Number(row.price_per_hour),
    clubSettings: row.club.settings,
    fromDate,
    toDate,
  })
  return { club_id: row.club_id, context }
}

/** Club `settings` jsonb, for callers that already know the court. */
export async function findClubSettings(clubId: string): Promise<unknown> {
  const { data, error } = await supabase.from('clubs').select('settings').eq('id', clubId).maybeSingle()
  if (error) throw error
  return data?.settings ?? null
}

/** Convenience for the booking flows, which already hold the court row. */
export async function loadScheduleContextForCourt(input: {
  courtId: string
  clubId: string
  basePricePerHour: number
  fromDate: string
  toDate: string
}): Promise<ScheduleContext> {
  return loadScheduleContext({
    courtId: input.courtId,
    clubId: input.clubId,
    basePricePerHour: Number(input.basePricePerHour),
    clubSettings: await findClubSettings(input.clubId),
    fromDate: input.fromDate,
    toDate: input.toDate,
  })
}

// ---- Card #71: calendar and blocks --------------------------------------------

/**
 * Same data as `loadScheduleContext` for several courts of one club with three
 * queries in total (the calendar shows every court of a club at once).
 */
export async function loadScheduleContextsForCourts(input: {
  clubId: string
  clubSettings: unknown
  courts: Array<{ id: string; price_per_hour: number }>
  fromDate: string
  toDate: string
}): Promise<Map<string, ScheduleContext>> {
  const result = new Map<string, ScheduleContext>()
  if (input.courts.length === 0) return result
  const ids = input.courts.map((c) => c.id)

  const [weekly, exceptions, rules] = await Promise.all([
    supabase
      .from('court_schedules')
      .select('court_id, day_of_week, open_time, close_time, slot_minutes')
      .in('court_id', ids)
      .eq('is_active', true),
    supabase
      .from('court_schedule_exceptions')
      .select('court_id, date, closed, open_time, close_time, slot_minutes, reason')
      .eq('club_id', input.clubId)
      .gte('date', input.fromDate)
      .lte('date', input.toDate),
    supabase
      .from('court_price_rules')
      .select('court_id, id, name, days_of_week, start_time, end_time, price_per_hour, priority, is_active')
      .in('court_id', ids)
      .eq('is_active', true),
  ])
  if (weekly.error) throw weekly.error
  if (exceptions.error) throw exceptions.error
  if (rules.error) throw rules.error

  const clubHours = openingHoursFrom(input.clubSettings)
  for (const court of input.courts) {
    result.set(court.id, {
      court_id: court.id,
      base_price_per_hour: Number(court.price_per_hour),
      weekly: (weekly.data ?? []).filter((w) => w.court_id === court.id) as unknown as WeeklyInterval[],
      exceptions: (exceptions.data ?? []).filter(
        (e) => e.court_id === null || e.court_id === court.id,
      ) as unknown as ScheduleException[],
      price_rules: (rules.data ?? [])
        .filter((r) => r.court_id === court.id)
        .map((r) => ({ ...(r as unknown as PriceRule), price_per_hour: Number(r.price_per_hour) })),
      club_hours: clubHours,
    })
  }
  return result
}

export interface BlockWindow {
  id: string
  court_id: string
  start_time: string
  end_time: string
}

/** Blocks of a court that overlap [start, end). Used by availability and by booking/move checks. */
export async function findBlocksOverlapping(courtId: string, start: string, end: string): Promise<BlockWindow[]> {
  const { data, error } = await supabase
    .from('court_blocks')
    .select('id, court_id, start_time, end_time')
    .eq('court_id', courtId)
    .lt('start_time', end)
    .gt('end_time', start)
  if (error) throw error
  return (data ?? []) as BlockWindow[]
}
