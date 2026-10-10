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
  created_at: string
  updated_at: string
}

const CLUB_COLUMNS =
  'id, name, slug, description, address, city, phone, email, logo_url, is_active, created_at, updated_at'

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
  page: number
  limit: number
}): Promise<{ data: PlatformClubRow[]; total: number }> {
  const { from, to } = rangeFor(options.page, options.limit)
  let query = supabase
    .from('clubs')
    .select(CLUB_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
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
