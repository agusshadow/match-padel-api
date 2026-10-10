import { ConflictError, NotFoundError } from '../../types/errors'
import { buildMeta } from '../../lib/pagination'
import { recordAudit } from '../audit/audit.service'
import * as repository from './club-admin.repository'
import type { ReservationStatus } from './club-admin.repository'
import type { UpdateClubInput } from './club-admin.validator'

// Argentina has no daylight saving: "today" for a club is the UTC-3 calendar day.
const CLUB_UTC_OFFSET_HOURS = -3

/** Start (inclusive) and end (exclusive) of the club-local day containing `now`, as ISO instants. */
export function clubDayBounds(now: Date): { start: string; end: string } {
  const shifted = new Date(now.getTime() + CLUB_UTC_OFFSET_HOURS * 3_600_000)
  const startUtcMs =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    CLUB_UTC_OFFSET_HOURS * 3_600_000
  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(startUtcMs + 24 * 3_600_000).toISOString(),
  }
}

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
}

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

async function requireClub(clubId: string): Promise<repository.ClubRow> {
  const club = await repository.findClub(clubId)
  if (!club) throw new NotFoundError('Club')
  return club
}

export async function getClub(clubId: string): Promise<repository.ClubRow> {
  return requireClub(clubId)
}

export async function updateClub(
  clubId: string,
  actorId: string,
  patch: UpdateClubInput,
): Promise<repository.ClubRow> {
  const before = await requireClub(clubId)
  const updated = await repository.updateClub(clubId, patch)
  if (!updated) throw new NotFoundError('Club')

  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(patch) as Array<keyof UpdateClubInput>) {
    if (before[key] !== updated[key]) changes[key] = { from: before[key], to: updated[key] }
  }
  await recordAudit({
    actorId,
    clubId,
    action: 'club.updated',
    entity: 'club',
    entityId: clubId,
    metadata: { changes },
  })
  return updated
}

export async function getSummary(clubId: string) {
  await requireClub(clubId)
  const { start, end } = clubDayBounds(new Date())

  const [courts, reservationsTotal, reservationsPending, reservationsToday, matches, recent] =
    await Promise.all([
      repository.countCourts(clubId),
      repository.countReservations(clubId),
      repository.countReservations(clubId, { status: 'pending' }),
      repository.countReservations(clubId, { startFrom: start, startBefore: end }),
      repository.countMatches(clubId),
      repository.findRecentReservations(clubId, 5),
    ])

  return {
    courts,
    reservations: { total: reservationsTotal, pending: reservationsPending, today: reservationsToday },
    matches,
    recentReservations: recent,
  }
}

export async function listReservations(
  clubId: string,
  options: { status?: ReservationStatus; page: number; limit: number },
) {
  const { data, total } = await repository.listReservations(clubId, options)
  return { data, meta: buildMeta(options.page, options.limit, total) }
}

export async function updateReservationStatus(
  clubId: string,
  reservationId: string,
  actorId: string,
  status: Exclude<ReservationStatus, 'pending'>,
) {
  const reservation = await repository.findReservationInClub(clubId, reservationId)
  if (!reservation) throw new NotFoundError('Reservation')

  if (reservation.status === status) return reservation

  if (!canTransition(reservation.status, status)) {
    throw new ConflictError(`A ${reservation.status} reservation cannot be changed to ${status}`)
  }

  await repository.updateReservationStatus(reservationId, status)
  await recordAudit({
    actorId,
    clubId,
    action: 'reservation.status_changed',
    entity: 'court_reservation',
    entityId: reservationId,
    metadata: { from: reservation.status, to: status },
  })

  return { ...reservation, status }
}

export async function listMatches(clubId: string, options: { page: number; limit: number }) {
  const { data, total } = await repository.listMatches(clubId, options)
  return { data, meta: buildMeta(options.page, options.limit, total) }
}

export async function listTournaments(clubId: string, options: { page: number; limit: number }) {
  const { data, total } = await repository.listTournaments(clubId, options)
  return { data, meta: buildMeta(options.page, options.limit, total) }
}
