import { NotFoundError } from '../../types/errors'
import { buildMeta } from '../../lib/pagination'
import { recordAudit } from '../audit/audit.service'
import * as mpAccountRepository from '../club-mercadopago/club-mercadopago.repository'
import { computeNetAmount, isConnectionUsable } from './charging.core'
import type { CollectionMode } from './charging.core'
import * as paymentRepository from './payment.repository'
import type { PaymentListRow } from './payment.repository'
import { resolveRange } from './payment.validator'

// Card #75: superadmin settings of each club's charges, and the payments listings
// of the platform and of a club's owner.

export interface ClubChargingSummary {
  id: string
  name: string
  commission_percent: number
  collection_mode: CollectionMode
  mp_connected: boolean
}

/** `mp_connected`: the club has a linked Mercado Pago account that is neither expired nor revoked. */
export async function findMpConnected(clubIds: string[], now: Date = new Date()): Promise<Map<string, boolean>> {
  const rows = await mpAccountRepository.findConnectionSummaries(clubIds)
  const result = new Map<string, boolean>(clubIds.map((id) => [id, false]))
  for (const row of rows) result.set(row.club_id, isConnectionUsable(row, now))
  return result
}

async function summaryOf(clubId: string): Promise<ClubChargingSummary> {
  const [row] = await paymentRepository.findClubChargingRows([clubId])
  if (!row) throw new NotFoundError('Club')
  const connected = await findMpConnected([clubId])
  return {
    id: row.id,
    name: row.name,
    commission_percent: row.commission_percent,
    collection_mode: row.collection_mode,
    mp_connected: connected.get(clubId) ?? false,
  }
}

export async function setClubCommission(actorId: string, clubId: string, percent: number): Promise<ClubChargingSummary> {
  const before = await paymentRepository.findClubChargingSettings(clubId)
  if (!before) throw new NotFoundError('Club')

  if (before.commission_percent !== percent) {
    const updated = await paymentRepository.updateClubCommission(clubId, percent)
    if (!updated) throw new NotFoundError('Club')
    await recordAudit({
      actorId,
      clubId,
      action: 'club.commission_changed',
      entity: 'club',
      entityId: clubId,
      metadata: {
        before: { commission_percent: before.commission_percent },
        after: { commission_percent: percent },
      },
    })
  }
  return summaryOf(clubId)
}

export async function setClubCollectionMode(
  actorId: string,
  clubId: string,
  mode: CollectionMode,
): Promise<ClubChargingSummary> {
  const before = await paymentRepository.findClubChargingSettings(clubId)
  if (!before) throw new NotFoundError('Club')

  if (before.collection_mode !== mode) {
    const updated = await paymentRepository.updateClubCollectionMode(clubId, mode)
    if (!updated) throw new NotFoundError('Club')
    await recordAudit({
      actorId,
      clubId,
      action: 'club.collection_mode_changed',
      entity: 'club',
      entityId: clubId,
      metadata: {
        before: { collection_mode: before.collection_mode },
        after: { collection_mode: mode },
      },
    })
  }
  return summaryOf(clubId)
}

// ---- Listings -----------------------------------------------------------------------

export interface PaymentRow extends Omit<PaymentListRow, 'marketplace_fee' | 'net_amount'> {
  /** Never null: 0 for payments collected by the platform or written before card #75. */
  marketplace_fee: number
  /** Never null: amount minus fee. */
  net_amount: number
}

function normalize(row: PaymentListRow): PaymentRow {
  const fee = row.marketplace_fee ?? 0
  return { ...row, marketplace_fee: fee, net_amount: row.net_amount ?? computeNetAmount(row.amount, fee) }
}

export interface PaymentsListing {
  data: PaymentRow[]
  meta: ReturnType<typeof buildMeta> & { totals: { gross: number; fee: number; net: number } }
}

async function listing(input: {
  clubId?: string
  from?: string
  to?: string
  page: number
  limit: number
}): Promise<PaymentsListing> {
  const range = resolveRange(input.from, input.to)
  const filters = { clubId: input.clubId, from: range.from, toExclusive: range.toExclusive }
  const [{ data, total }, totals] = await Promise.all([
    paymentRepository.listPayments({ ...filters, page: input.page, limit: input.limit }),
    paymentRepository.paymentTotals(filters),
  ])
  return {
    data: data.map(normalize),
    meta: {
      ...buildMeta(input.page, input.limit, total),
      totals: { gross: totals.gross, fee: totals.fee, net: totals.net },
    },
  }
}

/** Superadmin: every club (or one with `clubId`). */
export function listPlatformPayments(query: {
  clubId?: string
  from?: string
  to?: string
  page: number
  limit: number
}): Promise<PaymentsListing> {
  return listing(query)
}

/** Club owner: only the club's payments. */
export function listClubPayments(
  clubId: string,
  query: { from?: string; to?: string; page: number; limit: number },
): Promise<PaymentsListing> {
  return listing({ ...query, clubId })
}
