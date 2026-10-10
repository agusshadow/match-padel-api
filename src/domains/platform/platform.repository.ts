import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'
import type { CreateClubInput } from './platform.validator'

export interface PlatformClubRow {
  id: string
  name: string
  slug: string
  description: string | null
  address: string
  city: string
  phone: string | null
  email: string | null
  logo_url: string | null
  is_active: boolean
  status: string
  legal_name: string | null
  tax_id: string | null
  created_at: string
  updated_at: string
}

const CLUB_COLUMNS =
  'id, name, slug, description, address, city, phone, email, logo_url, is_active, status, legal_name, tax_id, created_at, updated_at'

type CountableTable = 'clubs' | 'courts' | 'court_reservations' | 'matches' | 'users'

export async function countRows(table: CountableTable, pendingOnly = false): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (pendingOnly) query = query.eq('status', 'pending')
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function findRecentReservations(limit: number): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select(
      `id, start_time, end_time, status, total_price, created_at,
       court:courts(id, name, club:clubs(id, name)),
       user:users(id, username, first_name, last_name)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listClubs(options: {
  search?: string
  /** Restricts to these statuses (an empty list matches nothing). */
  statuses?: string[]
  page: number
  limit: number
}): Promise<{ data: PlatformClubRow[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  let query = supabase
    .from('clubs')
    .select(CLUB_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (options.statuses) query = query.in('status', options.statuses)
  if (options.search) {
    query = query.or(
      `name.ilike.%${options.search}%,city.ilike.%${options.search}%,slug.ilike.%${options.search}%`,
    )
  }
  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as PlatformClubRow[], total: count ?? 0 }
}

export async function findClubById(id: string): Promise<PlatformClubRow | null> {
  const { data, error } = await supabase.from('clubs').select(CLUB_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as PlatformClubRow | null) ?? null
}

export async function insertClub(input: Omit<CreateClubInput, 'ownerUserId'>): Promise<PlatformClubRow> {
  const { data, error } = await supabase
    .from('clubs')
    .insert({
      name: input.name,
      slug: input.slug,
      address: input.address,
      city: input.city,
      description: input.description ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      // Superadmin-created clubs are born approved (card #67); the column default is 'draft'.
      status: 'approved',
    })
    .select(CLUB_COLUMNS)
    .single()
  if (error) throw error
  return data as PlatformClubRow
}

export async function deleteClub(id: string): Promise<void> {
  const { error } = await supabase.from('clubs').delete().eq('id', id)
  if (error) throw error
}

export async function insertOwner(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_staff')
    .insert({ club_id: clubId, user_id: userId, role: 'owner' })
  if (error) throw error
}

export async function userExists(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()
  if (error) throw error
  return data !== null
}

export async function setClubActive(id: string, isActive: boolean): Promise<PlatformClubRow | null> {
  const { data, error } = await supabase
    .from('clubs')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CLUB_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as PlatformClubRow | null) ?? null
}

export interface PlatformUserRow {
  id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export async function listUsers(options: {
  search?: string
  page: number
  limit: number
}): Promise<{ data: PlatformUserRow[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  let query = supabase
    .from('users')
    .select('id, username, first_name, last_name, role, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (options.search) {
    query = query.or(
      `username.ilike.%${options.search}%,first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%`,
    )
  }
  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as PlatformUserRow[], total: count ?? 0 }
}

/** Email lives in Supabase Auth, not in public.users. */
export async function findEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) return null
  return data.user?.email ?? null
}

export async function findUsersByIds(
  ids: string[],
): Promise<Array<{ id: string; username: string | null; first_name: string | null; last_name: string | null }>> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('users')
    .select('id, username, first_name, last_name')
    .in('id', ids)
  if (error) throw error
  return data ?? []
}

export async function findClubNamesByIds(ids: string[]): Promise<Array<{ id: string; name: string }>> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('clubs').select('id, name').in('id', ids)
  if (error) throw error
  return data ?? []
}

// ---- Card #68: application inbox -------------------------------------------

export interface ApplicationRow {
  id: string
  name: string
  city: string
  legal_name: string | null
  tax_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export async function listApplications(options: {
  search?: string
  statuses?: string[]
  oldestFirst: boolean
  page: number
  limit: number
}): Promise<{ data: ApplicationRow[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  let query = supabase
    .from('clubs')
    .select('id, name, city, legal_name, tax_id, status, created_at, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: options.oldestFirst })
    .order('id')
    .range(from, to)
  if (options.statuses) query = query.in('status', options.statuses)
  if (options.search) {
    const s = options.search
    query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%,legal_name.ilike.%${s}%,tax_id.ilike.%${s}%`)
  }
  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as ApplicationRow[], total: count ?? 0 }
}

export interface OwnerProfile {
  id: string
  first_name: string | null
  last_name: string | null
}

/** The first-registered owner of each club (a club may have several). */
export async function findOwnersByClubIds(clubIds: string[]): Promise<Map<string, OwnerProfile>> {
  const owners = new Map<string, OwnerProfile>()
  if (clubIds.length === 0) return owners
  const { data, error } = await supabase
    .from('club_staff')
    .select('club_id, user_id, created_at')
    .eq('role', 'owner')
    .in('club_id', clubIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  const firstOwner = new Map<string, string>()
  for (const row of data ?? []) {
    if (!firstOwner.has(row.club_id as string)) firstOwner.set(row.club_id as string, row.user_id as string)
  }
  const profiles = await findUsersByIds([...new Set(firstOwner.values())])
  const byId = new Map(profiles.map((p) => [p.id, p]))
  for (const [clubId, userId] of firstOwner) {
    const profile = byId.get(userId)
    owners.set(clubId, { id: userId, first_name: profile?.first_name ?? null, last_name: profile?.last_name ?? null })
  }
  return owners
}

/** Instant of the latest transition to `pending` per club (the last submission). */
export async function findSubmittedAtByClubIds(clubIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (clubIds.length === 0) return result
  const { data, error } = await supabase
    .from('club_status_history')
    .select('club_id, created_at')
    .eq('to_status', 'pending')
    .in('club_id', clubIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  for (const row of data ?? []) {
    if (!result.has(row.club_id as string)) result.set(row.club_id as string, row.created_at as string)
  }
  return result
}

export async function countDocumentsByClubIds(clubIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (clubIds.length === 0) return result
  const { data, error } = await supabase.from('club_documents').select('club_id').in('club_id', clubIds)
  if (error) throw error
  for (const row of data ?? []) {
    result.set(row.club_id as string, (result.get(row.club_id as string) ?? 0) + 1)
  }
  return result
}
