import { supabase } from '../../lib/supabase'

export interface ClubWithCourtsCount {
  id: string
  name: string
  slug: string
  address: string
  city: string
  description: string | null
  logo_url: string | null
  cover_url: string | null
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  courts_count: number
}

export interface ClubWithCourts {
  id: string
  name: string
  slug: string
  address: string
  city: string
  description: string | null
  logo_url: string | null
  cover_url: string | null
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  courts: CourtSummary[]
}

export interface CourtSummary {
  id: string
  name: string
  surface: string
  is_indoor: boolean
  price_per_hour: number
  is_active: boolean
}

export interface FindAllOptions {
  city?: string
  search?: string
  page?: number
  limit?: number
}

export async function findAll(
  options: FindAllOptions = {},
): Promise<{ data: ClubWithCourtsCount[]; total: number }> {
  const { city, search, page = 1, limit = 20 } = options
  const offset = (page - 1) * limit

  let query = supabase
    .from('clubs')
    .select('id, name, slug, address, city, description, logo_url, cover_url, email, phone, is_active, created_at', { count: 'exact' })
    .eq('is_active', true)
    .order('name')
    .range(offset, offset + limit - 1)

  if (city) {
    query = query.ilike('city', `%${city}%`)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  // Fetch courts count for each club
  const clubs = data ?? []
  const clubIds = clubs.map((c) => c.id)

  let courtsCountMap: Record<string, number> = {}

  if (clubIds.length > 0) {
    const { data: courtsData, error: courtsErr } = await supabase
      .from('courts')
      .select('club_id')
      .in('club_id', clubIds)
      .eq('is_active', true)

    if (!courtsErr && courtsData) {
      for (const court of courtsData) {
        courtsCountMap[court.club_id] = (courtsCountMap[court.club_id] ?? 0) + 1
      }
    }
  }

  const result: ClubWithCourtsCount[] = clubs.map((club) => ({
    ...club,
    courts_count: courtsCountMap[club.id] ?? 0,
  }))

  return { data: result, total: count ?? 0 }
}

export async function findById(id: string): Promise<ClubWithCourts | null> {
  const { data: club, error } = await supabase
    .from('clubs')
    .select('id, name, slug, address, city, description, logo_url, cover_url, email, phone, is_active, created_at')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const courts = await findCourts(id)

  return { ...club, courts }
}

export async function findCourts(clubId: string): Promise<CourtSummary[]> {
  const { data, error } = await supabase
    .from('courts')
    .select('id, name, surface, is_indoor, price_per_hour, is_active')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error

  return data ?? []
}
