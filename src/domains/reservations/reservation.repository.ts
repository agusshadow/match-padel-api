import { supabase } from '../../lib/supabase'
import type { CreateReservationRequest } from './reservation.validator'
import { loadPublicScheduleContext } from '../courts/court.repository'
import { resolveDay } from '../courts/schedule.service'

export interface ReservationWithJoins {
  id: string
  court_id: string
  club_id: string
  user_id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  total_price: number
  notes: string | null
  created_at: string
  updated_at: string
  court: {
    id: string
    name: string
    surface: string
    is_indoor: boolean
    price_per_hour: number
    club: {
      id: string
      name: string
      address: string
      city: string
      logo_url: string | null
    }
  }
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
  /** Hourly rate applied to this slot (card #70: price rule at the slot start, else the court's price). */
  price_per_hour: number
  /** Total for the slot, 2 decimals. */
  price: number
}

export interface FindByUserOptions {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  page?: number
  limit?: number
}

export async function findByUser(
  userId: string,
  options: FindByUserOptions = {},
): Promise<{ data: ReservationWithJoins[]; total: number }> {
  const { status, page = 1, limit = 20 } = options
  const offset = (page - 1) * limit

  let query = supabase
    .from('court_reservations')
    .select(
      `
      id, court_id, club_id, user_id, start_time, end_time,
      status, total_price, notes, created_at, updated_at,
      court:courts(
        id, name, surface, is_indoor, price_per_hour,
        club:clubs(id, name, address, city, logo_url)
      )
    `,
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []) as unknown as ReservationWithJoins[],
    total: count ?? 0,
  }
}

export async function findById(id: string): Promise<ReservationWithJoins | null> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select(
      `
      id, court_id, club_id, user_id, start_time, end_time,
      status, total_price, notes, created_at, updated_at,
      court:courts(
        id, name, surface, is_indoor, price_per_hour,
        club:clubs(id, name, address, city, logo_url)
      )
    `,
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as unknown as ReservationWithJoins
}

/**
 * Slots of a court on a club-local date, with price and availability.
 * Card #70: hours, exceptions and prices come from the effective schedule
 * (`courts/schedule.service.ts`); the court's weekly rows no longer have to be
 * a single interval per day.
 */
export async function findAvailableSlots(courtId: string, date: string): Promise<TimeSlot[]> {
  // Card #67: a court of a club that is not approved and active has no public slots.
  const loaded = await loadPublicScheduleContext(courtId, date)
  if (!loaded) return []

  const day = resolveDay(loaded.context, date)
  if (day.slots.length === 0) return []

  const slots: TimeSlot[] = day.slots.map((s) => ({
    start_time: s.start_time,
    end_time: s.end_time,
    available: true,
    price_per_hour: s.price_per_hour,
    price: s.price,
  }))

  // Reservations overlapping the offered window (slots can run up to midnight,
  // which is the next UTC day, so a UTC day filter would miss them).
  const windowStart = slots[0].start_time
  const windowEnd = slots[slots.length - 1].end_time
  const { data: existing, error: resErr } = await supabase
    .from('court_reservations')
    .select('start_time, end_time')
    .eq('court_id', courtId)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', windowEnd)
    .gt('end_time', windowStart)

  if (resErr) throw resErr

  // Compare instants, not strings: PostgREST returns `+00:00`, slots are `...Z`.
  const reservations = (existing ?? []).map((r) => ({
    start: new Date(r.start_time as string).getTime(),
    end: new Date(r.end_time as string).getTime(),
  }))
  const now = Date.now()

  for (const slot of slots) {
    const start = new Date(slot.start_time).getTime()
    const end = new Date(slot.end_time).getTime()

    // Past slots are also unavailable
    if (start <= now) {
      slot.available = false
      continue
    }

    // Overlap check: slot starts before res ends AND slot ends after res starts
    if (reservations.some((res) => start < res.end && end > res.start)) {
      slot.available = false
    }
  }

  return slots
}

export interface CreateReservationData extends CreateReservationRequest {
  userId: string
  clubId: string
  totalPrice: number
}

export async function create(data: CreateReservationData): Promise<ReservationWithJoins> {
  const { data: reservation, error } = await supabase
    .from('court_reservations')
    .insert({
      court_id: data.court_id,
      club_id: data.clubId,
      user_id: data.userId,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes ?? null,
      total_price: data.totalPrice,
      status: 'pending',
    })
    .select(
      `
      id, court_id, club_id, user_id, start_time, end_time,
      status, total_price, notes, created_at, updated_at,
      court:courts(
        id, name, surface, is_indoor, price_per_hour,
        club:clubs(id, name, address, city, logo_url)
      )
    `,
    )
    .single()

  if (error) throw error

  return reservation as unknown as ReservationWithJoins
}

export async function cancel(
  id: string,
  userId: string,
): Promise<ReservationWithJoins | null> {
  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('court_reservations')
    .select('id, user_id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return null

  if (existing.user_id !== userId) {
    throw new Error('NOT_OWNER')
  }

  if (!['pending', 'confirmed'].includes(existing.status)) {
    throw new Error('CANNOT_CANCEL')
  }

  const { data, error } = await supabase
    .from('court_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select(
      `
      id, court_id, club_id, user_id, start_time, end_time,
      status, total_price, notes, created_at, updated_at,
      court:courts(
        id, name, surface, is_indoor, price_per_hour,
        club:clubs(id, name, address, city, logo_url)
      )
    `,
    )
    .single()

  if (error) throw error

  return data as unknown as ReservationWithJoins
}

export interface BookableCourt {
  id: string
  club_id: string
  price_per_hour: number
  is_active: boolean
}

export async function getCourtForBooking(courtId: string): Promise<BookableCourt | null> {
  const { data, error } = await supabase
    .from('courts')
    .select('id, club_id, price_per_hour, is_active, club:clubs!inner(status, is_active)')
    .eq('id', courtId)
    .eq('club.status', 'approved') // card #67: only courts of approved, active clubs are bookable
    .eq('club.is_active', true)
    .single()

  if (error || !data) return null
  const { club: _club, ...court } = data as unknown as BookableCourt & { club: unknown }
  return court
}

export async function hasOverlap(
  courtId: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select('id')
    .eq('court_id', courtId)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', endTime)
    .gt('end_time', startTime)

  if (error) throw error
  return (data ?? []).length > 0
}

export async function updateStatus(
  id: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
): Promise<void> {
  const { error } = await supabase
    .from('court_reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function countActiveByUser(userId: string): Promise<number> {
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('court_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', now)

  if (error) throw error
  return count ?? 0
}

// Card #13/#50: a reservation that nobody pays for should free up the court
// instead of blocking it indefinitely. Cancels 'pending' reservations created
// more than `olderThanMinutes` ago — 'confirmed' ones (payment already
// approved) are never touched.
export async function expirePendingReservations(olderThanMinutes: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('court_reservations')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  if (error) throw error
  return (data ?? []).map((r) => r.id as string)
}
