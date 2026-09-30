import { supabase } from '../../lib/supabase'
import type { CreateReservationRequest } from './reservation.validator'

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

// Club opening hours are stored in Argentina local time (no DST). Every club is
// currently in Argentina, so a fixed offset is used instead of a per-club timezone.
const ARGENTINA_UTC_OFFSET = '-03:00'

export async function findAvailableSlots(courtId: string, date: string): Promise<TimeSlot[]> {
  // Get day of week (0 = Sunday, 6 = Saturday) from the date
  const dateObj = new Date(`${date}T00:00:00Z`)
  const dayOfWeek = dateObj.getUTCDay()

  // Get schedule for this court on this day
  const { data: schedule, error: schedErr } = await supabase
    .from('court_schedules')
    .select('open_time, close_time, slot_minutes')
    .eq('court_id', courtId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (schedErr || !schedule) {
    // No schedule for this day = no slots
    return []
  }

  // Generate all slots
  const slots: TimeSlot[] = []
  const [openH, openM] = schedule.open_time.split(':').map(Number)
  const [closeH, closeM] = schedule.close_time.split(':').map(Number)
  const slotMinutes = schedule.slot_minutes ?? 60

  let currentMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  while (currentMinutes + slotMinutes <= closeMinutes) {
    const startH = Math.floor(currentMinutes / 60)
    const startMin = currentMinutes % 60
    const endMinutes = currentMinutes + slotMinutes
    const endH = Math.floor(endMinutes / 60)
    const endMin = endMinutes % 60

    // Interpret the wall-clock time as Argentina local time, then normalize to UTC
    // (toISOString) so it compares correctly against reservation timestamps and `now`.
    const startTime = new Date(
      `${date}T${String(startH).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00${ARGENTINA_UTC_OFFSET}`,
    ).toISOString()
    const endTime = new Date(
      `${date}T${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00${ARGENTINA_UTC_OFFSET}`,
    ).toISOString()

    slots.push({ start_time: startTime, end_time: endTime, available: true })
    currentMinutes += slotMinutes
  }

  if (slots.length === 0) return []

  // Get existing reservations for this court on this date
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const { data: existing, error: resErr } = await supabase
    .from('court_reservations')
    .select('start_time, end_time')
    .eq('court_id', courtId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)

  if (resErr) throw resErr

  // Mark slots as unavailable where they overlap with existing reservations
  const reservations = existing ?? []
  const now = new Date().toISOString()

  for (const slot of slots) {
    // Past slots are also unavailable
    if (slot.start_time <= now) {
      slot.available = false
      continue
    }

    for (const res of reservations) {
      // Overlap check: slot starts before res ends AND slot ends after res starts
      if (slot.start_time < res.end_time && slot.end_time > res.start_time) {
        slot.available = false
        break
      }
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
    .select('id, club_id, price_per_hour, is_active')
    .eq('id', courtId)
    .single()

  if (error || !data) return null
  return data as BookableCourt
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
