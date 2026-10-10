import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'
import type { ClubChargingSettings, CollectedVia } from './charging.core'

// Queries added by card #75 (club charges and commission). The older queries of
// the charging flow still live inline in payment.service.ts (documented deviation).

export async function findClubChargingSettings(clubId: string): Promise<ClubChargingSettings | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, collection_mode, commission_percent')
    .eq('id', clubId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id as string,
    collection_mode: data.collection_mode as ClubChargingSettings['collection_mode'],
    commission_percent: Number(data.commission_percent),
  }
}

export interface ClubChargingRow extends ClubChargingSettings {
  name: string
}

export async function findClubChargingRows(clubIds: string[]): Promise<ClubChargingRow[]> {
  if (clubIds.length === 0) return []
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, collection_mode, commission_percent')
    .in('id', clubIds)
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    collection_mode: c.collection_mode as ClubChargingSettings['collection_mode'],
    commission_percent: Number(c.commission_percent),
  }))
}

export async function updateClubCommission(clubId: string, percent: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('clubs')
    .update({ commission_percent: percent, updated_at: new Date().toISOString() })
    .eq('id', clubId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function updateClubCollectionMode(
  clubId: string,
  mode: ClubChargingSettings['collection_mode'],
): Promise<boolean> {
  const { data, error } = await supabase
    .from('clubs')
    .update({ collection_mode: mode, updated_at: new Date().toISOString() })
    .eq('id', clubId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function findReservationClubId(reservationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('court_reservations')
    .select('club_id')
    .eq('id', reservationId)
    .maybeSingle()
  if (error) throw error
  return (data?.club_id as string | undefined) ?? null
}

export interface PaymentListRow {
  id: string
  created_at: string
  status: string
  amount: number
  currency: string
  marketplace_fee: number | null
  net_amount: number | null
  commission_percent: number | null
  collected_via: CollectedVia
  mp_payment_id: string | null
  seller_mp_user_id: string | null
  reservation_id: string | null
  club: { id: string; name: string } | null
}

export interface PaymentFilters {
  clubId?: string
  from?: Date
  /** Exclusive upper bound. */
  toExclusive?: Date
  page: number
  limit: number
}

export async function listPayments(filters: PaymentFilters): Promise<{ data: PaymentListRow[]; total: number }> {
  const { from, to } = rangeFor(filters.page, filters.limit)
  let query = supabase
    .from('payments')
    .select(
      `id, created_at, status, amount, currency, marketplace_fee, net_amount, commission_percent,
       collected_via, mp_payment_id, seller_mp_user_id, reservation_id,
       club:clubs(id, name)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, to)
  if (filters.clubId) query = query.eq('club_id', filters.clubId)
  if (filters.from) query = query.gte('created_at', filters.from.toISOString())
  if (filters.toExclusive) query = query.lt('created_at', filters.toExclusive.toISOString())
  const { data, error, count } = await query
  if (error) throw error
  const rows = (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>
    return {
      ...row,
      amount: Number(row.amount),
      marketplace_fee: row.marketplace_fee === null ? null : Number(row.marketplace_fee),
      net_amount: row.net_amount === null ? null : Number(row.net_amount),
      commission_percent: row.commission_percent === null ? null : Number(row.commission_percent),
    } as unknown as PaymentListRow
  })
  return { data: rows, total: count ?? 0 }
}

export interface PaymentTotals {
  gross: number
  fee: number
  net: number
  payments: number
}

/** Approved payments of the filter (the whole filter, not only the page). */
export async function paymentTotals(filters: Omit<PaymentFilters, 'page' | 'limit'>): Promise<PaymentTotals> {
  const { data, error } = await supabase.rpc('payment_totals', {
    p_club_id: filters.clubId ?? null,
    p_from: filters.from ? filters.from.toISOString() : null,
    p_to: filters.toExclusive ? filters.toExclusive.toISOString() : null,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  return {
    gross: Number(row?.gross ?? 0),
    fee: Number(row?.fee ?? 0),
    net: Number(row?.net ?? 0),
    payments: Number(row?.payments ?? 0),
  }
}
