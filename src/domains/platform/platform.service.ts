import { AppError, ConflictError, NotFoundError, ValidationError } from '../../types/errors'
import { buildMeta, sanitizeSearch } from '../../lib/pagination'
import { logger } from '../../lib/logger'
import { listAuditLog, recordAudit } from '../audit/audit.service'
import * as repository from './platform.repository'
import * as clubAdminRepository from '../club-admin/club-admin.repository'
import type {
  CreateClubInput,
  ListAuditLogQuery,
  ListClubsQuery,
  ListUsersQuery,
} from './platform.validator'

const UNIQUE_VIOLATION = '23505'

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
}

export async function getSummary() {
  const [clubs, courts, reservations, pendingReservations, matches, users, recentReservations] =
    await Promise.all([
      repository.countRows('clubs'),
      repository.countRows('courts'),
      repository.countRows('court_reservations'),
      repository.countRows('court_reservations', true),
      repository.countRows('matches'),
      repository.countRows('users'),
      repository.findRecentReservations(5),
    ])
  return { clubs, courts, reservations, pendingReservations, matches, users, recentReservations }
}

export async function listClubs(query: ListClubsQuery) {
  const search = query.search ? sanitizeSearch(query.search) : undefined
  const { data, total } = await repository.listClubs({ ...query, search: search || undefined })
  return { data, meta: buildMeta(query.page, query.limit, total) }
}

export async function createClub(actorId: string, input: CreateClubInput) {
  const { ownerUserId, ...clubInput } = input

  if (ownerUserId && !(await repository.userExists(ownerUserId))) {
    throw new ValidationError('ownerUserId does not match any user')
  }

  let club
  try {
    club = await repository.insertClub(clubInput)
  } catch (err) {
    if (errorCode(err) === UNIQUE_VIOLATION) throw new ConflictError('A club with that slug already exists')
    throw err
  }

  if (ownerUserId) {
    try {
      await repository.insertOwner(club.id, ownerUserId)
    } catch (err) {
      // Do not leave a club nobody can administer: undo the insert and fail.
      try {
        await repository.deleteClub(club.id)
      } catch (cleanupErr) {
        logger.error({ err: cleanupErr, clubId: club.id }, '[platform] failed to roll back club creation')
      }
      throw new AppError('Could not assign the club owner', 500, 'INTERNAL_ERROR')
    }
  }

  await recordAudit({
    actorId,
    clubId: club.id,
    action: 'club.created',
    entity: 'club',
    entityId: club.id,
    metadata: { name: club.name, slug: club.slug, ownerUserId: ownerUserId ?? null, status: 'approved' },
  })
  try {
    await clubAdminRepository.insertStatusHistory({
      clubId: club.id,
      actorId,
      fromStatus: null,
      toStatus: 'approved',
      note: 'Created by a platform superadmin',
    })
  } catch (err) {
    logger.error({ err, clubId: club.id }, '[platform] failed to record status history')
  }
  return club
}

export async function setClubActive(actorId: string, id: string, isActive: boolean) {
  const before = await repository.findClubById(id)
  if (!before) throw new NotFoundError('Club')

  const club = await repository.setClubActive(id, isActive)
  if (!club) throw new NotFoundError('Club')

  await recordAudit({
    actorId,
    clubId: id,
    action: isActive ? 'club.activated' : 'club.deactivated',
    entity: 'club',
    entityId: id,
    metadata: { from: before.is_active, to: isActive },
  })
  return club
}

export async function listUsers(query: ListUsersQuery) {
  const search = query.search ? sanitizeSearch(query.search) : undefined
  const { data, total } = await repository.listUsers({ ...query, search: search || undefined })
  const withEmail = await Promise.all(
    data.map(async (user) => ({ ...user, email: await repository.findEmail(user.id) })),
  )
  return { data: withEmail, meta: buildMeta(query.page, query.limit, total) }
}

export async function getAuditLog(query: ListAuditLogQuery) {
  const { data, total } = await listAuditLog(query)
  const actorIds = [...new Set(data.map((e) => e.actor_id).filter((id): id is string => id !== null))]
  const clubIds = [...new Set(data.map((e) => e.club_id).filter((id): id is string => id !== null))]
  const [actors, clubs] = await Promise.all([
    repository.findUsersByIds(actorIds),
    repository.findClubNamesByIds(clubIds),
  ])
  const actorById = new Map(actors.map((a) => [a.id, a]))
  const clubById = new Map(clubs.map((c) => [c.id, c]))
  const enriched = data.map((entry) => ({
    ...entry,
    actor: entry.actor_id ? (actorById.get(entry.actor_id) ?? null) : null,
    club: entry.club_id ? (clubById.get(entry.club_id) ?? null) : null,
  }))
  return { data: enriched, meta: buildMeta(query.page, query.limit, total) }
}

/** Signed URL of a club's application document (reviewers and superadmins). */
export async function getClubDocumentUrl(clubId: string, documentId: string) {
  const doc = await clubAdminRepository.findDocumentInClub(clubId, documentId)
  if (!doc) throw new NotFoundError('Document')
  const url = await clubAdminRepository.signDocumentUrl(doc.file_path, clubAdminRepository.DOCUMENT_URL_TTL_SECONDS)
  if (!url) throw new AppError('Could not generate the document URL', 500, 'INTERNAL_ERROR')
  return { url, expiresIn: clubAdminRepository.DOCUMENT_URL_TTL_SECONDS }
}
