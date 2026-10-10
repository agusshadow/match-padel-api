import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'
import type { UpdateClubInput } from './club-admin.validator'

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface ClubRow {
  id: string
  name: string
  slug: string
  description: string | null
  address: string
  city: string
  phone: string | null
  email: string | null
  logo_url: string | null
  cover_url: string | null
  lat: number | null
  lng: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const CLUB_COLUMNS =
  'id, name, slug, description, address, city, phone, email, logo_url, cover_url, lat, lng, is_active, created_at, updated_at'

export async function findClub(clubId: string): Promise<ClubRow | null> {
  const { data, error } = await supabase.from('clubs').select(CLUB_COLUMNS).eq('id', clubId).maybeSingle()
  if (error) throw error
  return (data as ClubRow | null) ?? null
}

export async function updateClub(clubId: string, patch: UpdateClubInput): Promise<ClubRow | null> {
  const { data, error } = await supabase
    .from('clubs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', clubId)
    .select(CLUB_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as ClubRow | null) ?? null
}

// ---- Summary counts ---------------------------------------------------------

export async function countCourts(clubId: string): Promise<number> {
  const { count, error } = await supabase
    .from('courts')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
  if (error) throw error
  return count ?? 0
}

export interface ReservationCountFilter {
  status?: ReservationStatus
  startFrom?: string
  startBefore?: string
}

export async function countReservations(clubId: string, filter: ReservationCountFilter = {}): Promise<number> {
  let query = supabase
    .from('court_reservations')
    .select('id, court:courts!inner(club_id)', { count: 'exact', head: true })
    .eq('court.club_id', clubId)
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.startFrom) query = query.gte('start_time', filter.startFrom)
  if (filter.startBefore) query = query.lt('start_time', filter.startBefore)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function countMatches(clubId: string): Promise<number> {
  const { count, error } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
  if (error) throw error
  return count ?? 0
}

// ---- Reservations -----------------------------------------------------------

const RESERVATION_SELECT = `
  id, court_id, user_id, start_time, end_time, status, total_price, notes, created_at, updated_at,
  court:courts!inner(id, name, club_id),
  user:users(id, username, first_name, last_name)
`

export interface ClubReservationRow {
  id: string
  court_id: string
  user_id: string
  start_time: string
  end_time: string
  status: ReservationStatus
  total_price: number
  notes: string | null
  created_at: string
  updated_at: string
  court: { id: string; name: string; club_id: string }
  user: { id: string; username: string | null; first_name: string | null; last_name: string | null } | null
}

export async function findRecentReservations(clubId: string, limit: number): Promise<ClubReservationRow[]> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select(RESERVATION_SELECT)
    .eq('court.club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as ClubReservationRow[]
}

export async function listReservations(
  clubId: string,
  options: { status?: ReservationStatus; page: number; limit: number },
): Promise<{ data: ClubReservationRow[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  let query = supabase
    .from('court_reservations')
    .select(RESERVATION_SELECT, { count: 'exact' })
    .eq('court.club_id', clubId)
    .order('start_time', { ascending: false })
    .range(from, to)
  if (options.status) query = query.eq('status', options.status)
  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as ClubReservationRow[], total: count ?? 0 }
}

/** Looks the reservation up through its court, so it only matches when the court belongs to the club. */
export async function findReservationInClub(
  clubId: string,
  reservationId: string,
): Promise<ClubReservationRow | null> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select(RESERVATION_SELECT)
    .eq('id', reservationId)
    .eq('court.club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as ClubReservationRow | null) ?? null
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('court_reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reservationId)
  if (error) throw error
}

// ---- Matches and tournaments ------------------------------------------------

export async function listMatches(
  clubId: string,
  options: { page: number; limit: number },
): Promise<{ data: unknown[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  const { data, error, count } = await supabase
    .from('matches')
    .select(
      `id, type, status, is_ranked, score_team1, score_team2, winner_team, created_at,
       reservation:court_reservations(start_time, end_time, court:courts(id, name)),
       players:match_players(team, user:users(id, username, first_name, last_name))`,
      { count: 'exact' },
    )
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data: data ?? [], total: count ?? 0 }
}

export async function listTournaments(
  clubId: string,
  options: { page: number; limit: number },
): Promise<{ data: unknown[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  const { data, error, count } = await supabase
    .from('tournaments')
    .select(
      `id, name, format, status, max_teams, entry_fee, prize_pool, start_date, end_date, created_at,
       teams:tournament_teams(count)`,
      { count: 'exact' },
    )
    .eq('club_id', clubId)
    .order('start_date', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data: data ?? [], total: count ?? 0 }
}
