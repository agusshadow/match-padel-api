import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'
import type { ClubStatus } from '../../types/access'
import type {
  CreateCourtInput,
  OpeningHours,
  UpdateClubInput,
  UpdateCourtInput,
} from './club-admin.validator'

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
  status: ClubStatus
  legal_name: string | null
  tax_id: string | null
  opening_hours: OpeningHours
  created_at: string
  updated_at: string
}

const CLUB_COLUMNS =
  'id, name, slug, description, address, city, phone, email, logo_url, cover_url, lat, lng, is_active, status, legal_name, tax_id, settings, created_at, updated_at'

type RawClubRow = Omit<ClubRow, 'opening_hours'> & { settings: Record<string, unknown> | null }

function toClubRow(raw: RawClubRow): ClubRow {
  const { settings, ...club } = raw
  const hours = settings && typeof settings === 'object' ? settings['opening_hours'] : undefined
  return { ...club, opening_hours: (hours && typeof hours === 'object' ? hours : {}) as OpeningHours }
}

/** Raw `settings` jsonb, needed to merge `opening_hours` without losing other keys. */
async function findSettings(clubId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('clubs').select('settings').eq('id', clubId).maybeSingle()
  if (error) throw error
  const settings = data?.settings
  return settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {}
}

export async function findClub(clubId: string): Promise<ClubRow | null> {
  const { data, error } = await supabase.from('clubs').select(CLUB_COLUMNS).eq('id', clubId).maybeSingle()
  if (error) throw error
  return data ? toClubRow(data as unknown as RawClubRow) : null
}

export async function updateClub(clubId: string, patch: UpdateClubInput): Promise<ClubRow | null> {
  const { opening_hours: openingHours, ...columns } = patch
  const update: Record<string, unknown> = { ...columns, updated_at: new Date().toISOString() }
  if (openingHours !== undefined) {
    update.settings = { ...(await findSettings(clubId)), opening_hours: openingHours }
  }
  const { data, error } = await supabase
    .from('clubs')
    .update(update)
    .eq('id', clubId)
    .select(CLUB_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return data ? toClubRow(data as unknown as RawClubRow) : null
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

// ---- Card #67: onboarding ---------------------------------------------------

export interface CourtRow {
  id: string
  club_id: string
  name: string
  surface: 'indoor' | 'outdoor' | 'panoramic'
  is_indoor: boolean
  price_per_hour: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const COURT_COLUMNS = 'id, club_id, name, surface, is_indoor, price_per_hour, is_active, created_at, updated_at'

export async function listCourts(clubId: string): Promise<CourtRow[]> {
  const { data, error } = await supabase
    .from('courts')
    .select(COURT_COLUMNS)
    .eq('club_id', clubId)
    .order('name')
  if (error) throw error
  return (data ?? []) as CourtRow[]
}

export async function findCourtInClub(clubId: string, courtId: string): Promise<CourtRow | null> {
  const { data, error } = await supabase
    .from('courts')
    .select(COURT_COLUMNS)
    .eq('id', courtId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as CourtRow | null) ?? null
}

export async function insertCourt(clubId: string, input: CreateCourtInput): Promise<CourtRow> {
  const { data, error } = await supabase
    .from('courts')
    .insert({ club_id: clubId, ...input })
    .select(COURT_COLUMNS)
    .single()
  if (error) throw error
  return data as CourtRow
}

export async function updateCourt(courtId: string, patch: UpdateCourtInput): Promise<CourtRow | null> {
  const { data, error } = await supabase
    .from('courts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', courtId)
    .select(COURT_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as CourtRow | null) ?? null
}

export async function countCourtReservations(courtId: string): Promise<number> {
  const { count, error } = await supabase
    .from('court_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('court_id', courtId)
  if (error) throw error
  return count ?? 0
}

export async function deleteCourt(courtId: string): Promise<void> {
  const { error } = await supabase.from('courts').delete().eq('id', courtId)
  if (error) throw error
}

// Clubs, status and history

export interface MyClubDraft {
  id: string
  name: string
  address: string
  city: string
}

/** Clubs of the user where they are the owner and which are still in draft. */
export async function listOwnedDrafts(userId: string): Promise<MyClubDraft[]> {
  const { data, error } = await supabase
    .from('club_staff')
    .select('club:clubs!inner(id, name, address, city, status)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('club.status', 'draft')
  if (error) throw error
  return ((data ?? []) as unknown as Array<{ club: MyClubDraft }>).map((row) => ({
    id: row.club.id,
    name: row.club.name,
    address: row.club.address,
    city: row.club.city,
  }))
}

export async function insertDraftClub(input: {
  name: string
  slug: string
  address: string
  city: string
}): Promise<ClubRow> {
  const { data, error } = await supabase
    .from('clubs')
    .insert({ ...input, status: 'draft' })
    .select(CLUB_COLUMNS)
    .single()
  if (error) throw error
  return toClubRow(data as unknown as RawClubRow)
}

export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabase.from('clubs').delete().eq('id', clubId)
  if (error) throw error
}

export async function insertOwner(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('club_staff').insert({ club_id: clubId, user_id: userId, role: 'owner' })
  if (error) throw error
}

/** Compare-and-set: only changes the status when it is still one of `from`. Returns the row or null. */
export async function transitionStatus(
  clubId: string,
  from: ClubStatus[],
  to: ClubStatus,
): Promise<ClubRow | null> {
  const { data, error } = await supabase
    .from('clubs')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', clubId)
    .in('status', from)
    .select(CLUB_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return data ? toClubRow(data as unknown as RawClubRow) : null
}

export async function insertStatusHistory(input: {
  clubId: string
  actorId: string | null
  fromStatus: ClubStatus | null
  toStatus: ClubStatus
  note?: string | null
}): Promise<void> {
  const { error } = await supabase.from('club_status_history').insert({
    club_id: input.clubId,
    actor_id: input.actorId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note ?? null,
  })
  if (error) throw error
}

export interface StatusHistoryRow {
  id: string
  from_status: ClubStatus | null
  to_status: ClubStatus
  note: string | null
  created_at: string
  actor: { id: string; first_name: string | null; last_name: string | null } | null
}

export async function listStatusHistory(clubId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await supabase
    .from('club_status_history')
    .select(
      'id, from_status, to_status, note, created_at, actor:users!club_status_history_actor_id_fkey(id, first_name, last_name)',
    )
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as StatusHistoryRow[]
}

// Documents

export type DocumentKind = 'tax_id' | 'company_registration' | 'id_document' | 'other'

export interface DocumentRow {
  id: string
  club_id: string
  uploaded_by: string | null
  kind: DocumentKind
  file_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

const DOCUMENT_COLUMNS = 'id, club_id, uploaded_by, kind, file_path, file_name, mime_type, size_bytes, created_at'
const DOCUMENTS_BUCKET = 'club-documents'
export const DOCUMENT_URL_TTL_SECONDS = 600

export async function listDocuments(clubId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('club_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('club_id', clubId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as DocumentRow[]
}

export async function findDocumentInClub(clubId: string, documentId: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('club_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as DocumentRow | null) ?? null
}

export async function insertDocument(input: Omit<DocumentRow, 'id' | 'created_at'>): Promise<DocumentRow> {
  const { data, error } = await supabase.from('club_documents').insert(input).select(DOCUMENT_COLUMNS).single()
  if (error) throw error
  return data as DocumentRow
}

export async function deleteDocumentRow(documentId: string): Promise<void> {
  const { error } = await supabase.from('club_documents').delete().eq('id', documentId)
  if (error) throw error
}

export async function uploadDocumentFile(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false })
  if (error) throw error
}

export async function removeDocumentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
  if (error) throw error
}

export async function signDocumentUrl(path: string, expiresInSeconds: number): Promise<string | null> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

// ---- Card #70: schedules, exceptions and price rules ------------------------

export interface ScheduleRow {
  day_of_week: number
  open_time: string
  close_time: string
  slot_minutes: number
}

export async function listCourtSchedule(courtId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('court_schedules')
    .select('day_of_week, open_time, close_time, slot_minutes')
    .eq('court_id', courtId)
    .eq('is_active', true)
    .order('day_of_week')
    .order('open_time')
  if (error) throw error
  return (data ?? []) as ScheduleRow[]
}

/** Atomic delete + insert through `replace_court_schedule` (service_role only). */
export async function replaceCourtSchedule(courtId: string, rows: ScheduleRow[]): Promise<void> {
  const { error } = await supabase.rpc('replace_court_schedule', { p_court_id: courtId, p_rows: rows })
  if (error) throw error
}

/** Number of active courts of the club that have at least one active weekly row. */
export async function countCourtsWithSchedule(clubId: string): Promise<number> {
  const { data, error } = await supabase
    .from('court_schedules')
    .select('court_id, court:courts!inner(club_id, is_active)')
    .eq('is_active', true)
    .eq('court.club_id', clubId)
    .eq('court.is_active', true)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.court_id as string)).size
}

export interface ExceptionRow {
  id: string
  club_id: string
  court_id: string | null
  date: string
  closed: boolean
  open_time: string | null
  close_time: string | null
  slot_minutes: number | null
  reason: string | null
  created_by: string | null
  created_at: string
}

const EXCEPTION_COLUMNS =
  'id, club_id, court_id, date, closed, open_time, close_time, slot_minutes, reason, created_by, created_at'

export async function listExceptions(
  clubId: string,
  filters: { courtId?: string; from: string; to?: string },
): Promise<ExceptionRow[]> {
  let query = supabase
    .from('court_schedule_exceptions')
    .select(EXCEPTION_COLUMNS)
    .eq('club_id', clubId)
    .gte('date', filters.from)
    .order('date')
    .order('court_id', { nullsFirst: true })
    .limit(500)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.courtId) query = query.eq('court_id', filters.courtId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ExceptionRow[]
}

export async function findExceptionInClub(clubId: string, id: string): Promise<ExceptionRow | null> {
  const { data, error } = await supabase
    .from('court_schedule_exceptions')
    .select(EXCEPTION_COLUMNS)
    .eq('id', id)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as ExceptionRow | null) ?? null
}

/** Replaces any exception already set for the same court (or club) and dates, then inserts. */
export async function replaceExceptions(
  clubId: string,
  courtId: string | null,
  dates: string[],
  fields: {
    closed: boolean
    open_time: string | null
    close_time: string | null
    slot_minutes: number | null
    reason: string | null
    created_by: string
  },
): Promise<ExceptionRow[]> {
  let del = supabase.from('court_schedule_exceptions').delete().eq('club_id', clubId).in('date', dates)
  del = courtId ? del.eq('court_id', courtId) : del.is('court_id', null)
  const { error: delErr } = await del
  if (delErr) throw delErr

  const { data, error } = await supabase
    .from('court_schedule_exceptions')
    .insert(dates.map((date) => ({ club_id: clubId, court_id: courtId, date, ...fields })))
    .select(EXCEPTION_COLUMNS)
    .order('date')
  if (error) throw error
  return (data ?? []) as ExceptionRow[]
}

export async function deleteException(id: string): Promise<void> {
  const { error } = await supabase.from('court_schedule_exceptions').delete().eq('id', id)
  if (error) throw error
}

export interface PriceRuleRow {
  id: string
  court_id: string
  name: string
  days_of_week: number[]
  start_time: string
  end_time: string
  price_per_hour: number
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function listPriceRules(courtId: string): Promise<PriceRuleRow[]> {
  const { data, error } = await supabase
    .from('court_price_rules')
    .select('id, court_id, name, days_of_week, start_time, end_time, price_per_hour, priority, is_active, created_at, updated_at')
    .eq('court_id', courtId)
    .order('priority', { ascending: false })
    .order('start_time')
    .order('created_at')
  if (error) throw error
  return ((data ?? []) as PriceRuleRow[]).map((r) => ({ ...r, price_per_hour: Number(r.price_per_hour) }))
}

/** Atomic delete + insert through `replace_court_price_rules` (service_role only). */
export async function replacePriceRules(
  courtId: string,
  rows: Array<{
    name: string
    days_of_week: number[]
    start_time: string
    end_time: string
    price_per_hour: number
    priority: number
    is_active: boolean
  }>,
): Promise<void> {
  const { error } = await supabase.rpc('replace_court_price_rules', { p_court_id: courtId, p_rows: rows })
  if (error) throw error
}

/** Pending or confirmed reservations of a court (or of the whole club) starting in [from, to). */
export async function countOpenReservations(
  clubId: string,
  courtId: string | null,
  range: { from?: string; to?: string },
): Promise<number> {
  let query = supabase
    .from('court_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .in('status', ['pending', 'confirmed'])
  if (courtId) query = query.eq('court_id', courtId)
  if (range.from) query = query.gte('start_time', range.from)
  if (range.to) query = query.lt('start_time', range.to)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

// ---- Card #71: calendar and blocks --------------------------------------------

const CHUNK = 100

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Pending, confirmed and completed reservations of the given courts overlapping [from, to). */
export async function listCalendarReservations(
  clubId: string,
  courtIds: string[],
  range: { from: string; to: string },
): Promise<ClubReservationRow[]> {
  if (courtIds.length === 0) return []
  const { data, error } = await supabase
    .from('court_reservations')
    .select(RESERVATION_SELECT)
    .eq('court.club_id', clubId)
    .in('court_id', courtIds)
    .in('status', ['pending', 'confirmed', 'completed'])
    .lt('start_time', range.to)
    .gt('end_time', range.from)
    .order('start_time')
  if (error) throw error
  return (data ?? []) as unknown as ClubReservationRow[]
}

export interface PaymentSummaryRow {
  reservation_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
  amount: number
}

/** Approved and refunded payments of the reservations (the ones that say how much was paid). */
export async function listPaymentsForReservations(reservationIds: string[]): Promise<PaymentSummaryRow[]> {
  const rows: PaymentSummaryRow[] = []
  for (const ids of chunks(reservationIds)) {
    const { data, error } = await supabase
      .from('payments')
      .select('reservation_id, status, amount')
      .in('reservation_id', ids)
      .in('status', ['approved', 'refunded'])
    if (error) throw error
    for (const r of data ?? []) rows.push({ ...(r as PaymentSummaryRow), amount: Number(r.amount) })
  }
  return rows
}

export interface ReservationMatchRow {
  id: string
  reservation_id: string
  type: 'friendly' | 'ranked' | 'tournament'
  is_ranked: boolean
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled'
  players_count: number
}

export async function listMatchesForReservations(reservationIds: string[]): Promise<ReservationMatchRow[]> {
  const rows: ReservationMatchRow[] = []
  for (const ids of chunks(reservationIds)) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, reservation_id, type, is_ranked, status, players:match_players(count)')
      .in('reservation_id', ids)
    if (error) throw error
    for (const m of (data ?? []) as unknown as Array<Omit<ReservationMatchRow, 'players_count'> & { players: Array<{ count: number }> | null }>) {
      const { players, ...rest } = m
      rows.push({ ...rest, players_count: players?.[0]?.count ?? 0 })
    }
  }
  return rows
}

export interface BlockRow {
  id: string
  club_id: string
  court_id: string
  start_time: string
  end_time: string
  reason: string | null
  created_by: string | null
  created_at: string
}

const BLOCK_COLUMNS = 'id, club_id, court_id, start_time, end_time, reason, created_by, created_at'

/** Blocks of the club overlapping [from, to) (either bound optional), optionally of given courts. */
export async function listBlocks(
  clubId: string,
  filters: { courtIds?: string[]; from?: string; to?: string; limit?: number },
): Promise<BlockRow[]> {
  let query = supabase
    .from('court_blocks')
    .select(BLOCK_COLUMNS)
    .eq('club_id', clubId)
    .order('start_time')
    .limit(filters.limit ?? 500)
  if (filters.courtIds) query = query.in('court_id', filters.courtIds)
  if (filters.to) query = query.lt('start_time', filters.to)
  if (filters.from) query = query.gt('end_time', filters.from)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as BlockRow[]
}

export async function findBlockInClub(clubId: string, id: string): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from('court_blocks')
    .select(BLOCK_COLUMNS)
    .eq('id', id)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as BlockRow | null) ?? null
}

export interface BlockConflict {
  type: 'reservation' | 'block'
  id: string
  court_id: string
  start_time: string
  end_time: string
  /** reservation only */
  status?: string
  user?: { id: string; first_name: string | null; last_name: string | null; username: string | null } | null
  match_id?: string | null
  /** block only */
  reason?: string | null
}

export interface CreateBlocksResult {
  conflicts: BlockConflict[]
  blocks: BlockRow[]
}

/** Atomic one-row-per-court insert through `create_court_blocks` (service_role only). */
export async function createBlocks(input: {
  clubId: string
  courtIds: string[]
  startTime: string
  endTime: string
  reason: string | null
  createdBy: string
}): Promise<CreateBlocksResult> {
  const { data, error } = await supabase.rpc('create_court_blocks', {
    p_club_id: input.clubId,
    p_court_ids: input.courtIds,
    p_start: input.startTime,
    p_end: input.endTime,
    p_reason: input.reason,
    p_created_by: input.createdBy,
  })
  if (error) throw error
  return data as unknown as CreateBlocksResult
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await supabase.from('court_blocks').delete().eq('id', id)
  if (error) throw error
}
