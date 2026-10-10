import { supabase } from '../../lib/supabase'
import { rangeFor, sanitizeSearch } from '../../lib/pagination'

// Card #78: every Supabase query of the gamification catalogs admin. The three
// catalogs share the same list/get/insert/update shape, so the helpers are
// generic over the table name.

export type CatalogTable = 'achievements' | 'challenges' | 'cosmetics'

export interface AchievementRow {
  id: string
  code: string
  name: string
  description: string
  icon: string
  points: number
  condition: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChallengeRow {
  id: string
  code: string
  name: string
  description: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'one_time'
  action_type: 'play_matches' | 'win_matches'
  target_count: number
  reward_xp: number
  reward_currency: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CosmeticRow {
  id: string
  code: string
  name: string
  description: string
  type: 'palette_skin' | 'avatar' | 'emblem'
  image_url: string
  price_currency: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const COLUMNS: Record<CatalogTable, string> = {
  achievements: 'id, code, name, description, icon, points, condition, is_active, created_at, updated_at',
  challenges:
    'id, code, name, description, cadence, action_type, target_count, reward_xp, reward_currency, is_active, created_at, updated_at',
  cosmetics: 'id, code, name, description, type, image_url, price_currency, is_active, created_at, updated_at',
}

export interface ListFilters {
  search?: string
  is_active?: boolean
  /** Equality filters on enum columns (cadence, action_type, type). */
  equals?: Record<string, string | undefined>
  page: number
  limit: number
}

export async function list<T>(table: CatalogTable, filters: ListFilters): Promise<{ data: T[]; total: number }> {
  const { from, to } = rangeFor(filters.page, filters.limit)
  let query = supabase
    .from(table)
    .select(COLUMNS[table], { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('code', { ascending: true })
    .range(from, to)

  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active)
  for (const [column, value] of Object.entries(filters.equals ?? {})) {
    if (value !== undefined) query = query.eq(column, value)
  }
  if (filters.search) {
    const term = sanitizeSearch(filters.search)
    if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as T[], total: count ?? 0 }
}

export async function findById<T>(table: CatalogTable, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select(COLUMNS[table]).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as T | null) ?? null
}

/** Throws the Postgres error as is (23505 on a duplicate code). */
export async function insert<T>(table: CatalogTable, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(row).select(COLUMNS[table]).single()
  if (error) throw error
  return data as unknown as T
}

export async function update<T>(table: CatalogTable, id: string, patch: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .select(COLUMNS[table])
    .maybeSingle()
  if (error) throw error
  return (data as unknown as T | null) ?? null
}

async function countWhere(table: string, column: string, id: string, extra?: [string, string]): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, id)
  if (extra) query = query.eq(extra[0], extra[1])
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export function countAchievementOwners(achievementId: string): Promise<number> {
  return countWhere('user_achievements', 'achievement_id', achievementId)
}

export function countCosmeticOwners(cosmeticId: string): Promise<number> {
  return countWhere('user_cosmetics', 'cosmetic_id', cosmeticId)
}

export function countChallengeAssignments(challengeId: string): Promise<number> {
  return countWhere('user_challenges', 'challenge_id', challengeId)
}

export function countChallengeActiveAssignments(challengeId: string): Promise<number> {
  return countWhere('user_challenges', 'challenge_id', challengeId, ['status', 'active'])
}

// ---- Images (public bucket) ------------------------------------------------

export const ASSETS_BUCKET = 'catalog-assets'

export async function uploadAsset(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, buffer, { contentType, upsert: false })
  if (error) throw error
  return supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl
}
