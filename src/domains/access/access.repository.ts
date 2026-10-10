import { supabase } from '../../lib/supabase'
import type { ClubMembership, PlatformRole, StaffRole } from '../../types/access'

export interface AccessClub {
  id: string
  name: string
  slug: string
  is_active: boolean
  status: string
}

export interface AccessUserProfile {
  first_name: string | null
  last_name: string | null
}

export async function findPlatformRole(userId: string): Promise<PlatformRole | null> {
  const { data, error } = await supabase
    .from('platform_staff')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.role as PlatformRole | undefined) ?? null
}

export async function findMemberships(userId: string): Promise<ClubMembership[]> {
  const { data, error } = await supabase
    .from('club_staff')
    .select('club_id, role')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => ({ clubId: row.club_id as string, role: row.role as StaffRole }))
}

export async function findClubsByIds(ids: string[]): Promise<AccessClub[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, slug, is_active, status')
    .in('id', ids)
    .order('name')
  if (error) throw error
  return (data ?? []) as AccessClub[]
}

export async function findAllClubs(): Promise<AccessClub[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, slug, is_active, status')
    .order('name')
  if (error) throw error
  return (data ?? []) as AccessClub[]
}

export async function findProfile(userId: string): Promise<AccessUserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as AccessUserProfile | null) ?? null
}

/** Email lives in Supabase Auth, not in public.users. */
export async function findEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) return null
  return data.user?.email ?? null
}
