import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../types/errors'
import type { ClubStatus, PlatformRole } from '../../types/access'
import { notifyApplicationStatusChange } from '../mail/mail.service'
import { buildMeta, sanitizeSearch } from '../../lib/pagination'
import { logger } from '../../lib/logger'
import { listAuditLog, recordAudit } from '../audit/audit.service'
import * as repository from './platform.repository'
import * as clubAdminRepository from '../club-admin/club-admin.repository'
import * as paymentRepository from '../payments/payment.repository'
import { findMpConnected } from '../payments/payment-admin.service'
import type {
  CreateClubInput,
  ListApplicationsQuery,
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

// ---- Card #68: what each platform role may see -----------------------------

/** The only statuses a reviewer can see: clubs waiting for (or returned from) a review. */
export const REVIEW_STATUSES: readonly ClubStatus[] = ['pending', 'changes_requested']

/** Pure: can a caller with this platform role see a club in this status? */
export function canSeeStatus(role: PlatformRole, status: ClubStatus): boolean {
  return role === 'superadmin' || REVIEW_STATUSES.includes(status)
}

/**
 * Pure: statuses to filter by for a requested filter. `undefined` means no
 * filter (superadmin, `all`). A reviewer asking for a status outside
 * `REVIEW_STATUSES` is refused instead of silently getting an empty list.
 */
export function resolveStatusFilter(role: PlatformRole, requested: ClubStatus | 'all' | undefined): ClubStatus[] | undefined {
  if (requested === undefined || requested === 'all') {
    return role === 'superadmin' ? undefined : [...REVIEW_STATUSES]
  }
  if (!canSeeStatus(role, requested)) {
    throw new ForbiddenError('Reviewers can only see applications that are pending or have changes requested')
  }
  return [requested]
}

export async function listClubs(query: ListClubsQuery, role: PlatformRole) {
  const search = query.search ? sanitizeSearch(query.search) : undefined
  const { data, total } = await repository.listClubs({
    page: query.page,
    limit: query.limit,
    search: search || undefined,
    statuses: resolveStatusFilter(role, query.status),
  })
  // Card #75: commission and collection mode are the superadmin's; a reviewer never sees them.
  if (role !== 'superadmin') return { data, meta: buildMeta(query.page, query.limit, total) }
  const ids = data.map((club) => club.id)
  const [charging, connected] = await Promise.all([
    paymentRepository.findClubChargingRows(ids),
    findMpConnected(ids),
  ])
  const chargingById = new Map(charging.map((c) => [c.id, c]))
  const rows = data.map((club) => ({
    ...club,
    commission_percent: chargingById.get(club.id)?.commission_percent ?? 0,
    collection_mode: chargingById.get(club.id)?.collection_mode ?? 'platform_account',
    mp_connected: connected.get(club.id) ?? false,
  }))
  return { data: rows, meta: buildMeta(query.page, query.limit, total) }
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
export async function getClubDocumentUrl(clubId: string, documentId: string, role: PlatformRole) {
  await requireVisibleClub(clubId, role)
  const doc = await clubAdminRepository.findDocumentInClub(clubId, documentId)
  if (!doc) throw new NotFoundError('Document')
  const url = await clubAdminRepository.signDocumentUrl(doc.file_path, clubAdminRepository.DOCUMENT_URL_TTL_SECONDS)
  if (!url) throw new AppError('Could not generate the document URL', 500, 'INTERNAL_ERROR')
  return { url, expiresIn: clubAdminRepository.DOCUMENT_URL_TTL_SECONDS }
}

// ---- Card #68: application inbox, detail and review actions ----------------

async function requireVisibleClub(clubId: string, role: PlatformRole) {
  const club = await clubAdminRepository.findClub(clubId)
  // 404 (not 403) for what a reviewer must not see: it does not reveal the club exists.
  if (!club || !canSeeStatus(role, club.status)) throw new NotFoundError('Application')
  return club
}

function fullName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name.length > 0 ? name : null
}

export async function listApplications(query: ListApplicationsQuery, role: PlatformRole) {
  const status = query.status ?? 'pending'
  const search = query.search ? sanitizeSearch(query.search) : undefined
  const { data, total } = await repository.listApplications({
    page: query.page,
    limit: query.limit,
    search: search || undefined,
    statuses: resolveStatusFilter(role, status),
    // The inbox works first-in first-out; other lists show the latest activity first.
    oldestFirst: status === 'pending',
  })

  const ids = data.map((row) => row.id)
  const [owners, submittedAt, documents] = await Promise.all([
    repository.findOwnersByClubIds(ids),
    repository.findSubmittedAtByClubIds(ids),
    repository.countDocumentsByClubIds(ids),
  ])
  const emails = new Map<string, string | null>()
  await Promise.all(
    [...new Set([...owners.values()].map((o) => o.id))].map(async (userId) => {
      emails.set(userId, await repository.findEmail(userId))
    }),
  )

  const rows = data.map((club) => {
    const owner = owners.get(club.id)
    return {
      id: club.id,
      name: club.name,
      city: club.city,
      legal_name: club.legal_name,
      tax_id: club.tax_id,
      status: club.status,
      owner: owner ? { ...owner, email: emails.get(owner.id) ?? null } : null,
      submitted_at: submittedAt.get(club.id) ?? null,
      documents_count: documents.get(club.id) ?? 0,
    }
  })
  return { data: rows, meta: buildMeta(query.page, query.limit, total) }
}

export async function getApplication(clubId: string, role: PlatformRole) {
  const club = await requireVisibleClub(clubId, role)
  const [courts, documents, history, owners, submittedAt] = await Promise.all([
    clubAdminRepository.listCourts(clubId),
    clubAdminRepository.listDocuments(clubId),
    clubAdminRepository.listStatusHistory(clubId),
    repository.findOwnersByClubIds([clubId]),
    repository.findSubmittedAtByClubIds([clubId]),
  ])
  const owner = owners.get(clubId)
  // Card #75: commission, collection mode and link state only for the superadmin.
  let clubWithCharging: typeof club & {
    commission_percent?: number
    collection_mode?: string
    mp_connected?: boolean
  } = club
  if (role === 'superadmin') {
    const [chargingRow] = await paymentRepository.findClubChargingRows([clubId])
    const connected = await findMpConnected([clubId])
    clubWithCharging = {
      ...club,
      commission_percent: chargingRow?.commission_percent ?? 0,
      collection_mode: chargingRow?.collection_mode ?? 'platform_account',
      mp_connected: connected.get(clubId) ?? false,
    }
  }
  const signedDocuments = await Promise.all(
    documents.map(async (doc) => ({
      id: doc.id,
      kind: doc.kind,
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      uploaded_by: doc.uploaded_by,
      created_at: doc.created_at,
      url: await clubAdminRepository.signDocumentUrl(doc.file_path, clubAdminRepository.DOCUMENT_URL_TTL_SECONDS),
    })),
  )
  return {
    club: clubWithCharging,
    owner: owner ? { ...owner, email: await repository.findEmail(owner.id) } : null,
    courts,
    documents: signedDocuments,
    history,
    submitted_at: submittedAt.get(clubId) ?? null,
    documents_expires_in: clubAdminRepository.DOCUMENT_URL_TTL_SECONDS,
  }
}

export type LifecycleAction = 'approve' | 'request_changes' | 'reject' | 'reopen' | 'suspend' | 'unsuspend'

interface LifecycleTransition {
  from: ClubStatus
  to: ClubStatus
  audit: string
  /** Who may run it: `reviewer` means reviewer or superadmin. Enforced by the router. */
  role: PlatformRole
}

/** The platform-driven part of the club lifecycle (docs/club-lifecycle.md). Pure data. */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleAction, LifecycleTransition> = {
  approve: { from: 'pending', to: 'approved', audit: 'club.approved', role: 'reviewer' },
  request_changes: { from: 'pending', to: 'changes_requested', audit: 'club.changes_requested', role: 'reviewer' },
  reject: { from: 'pending', to: 'rejected', audit: 'club.rejected', role: 'reviewer' },
  reopen: { from: 'rejected', to: 'draft', audit: 'club.reopened', role: 'superadmin' },
  suspend: { from: 'approved', to: 'suspended', audit: 'club.suspended', role: 'superadmin' },
  unsuspend: { from: 'suspended', to: 'approved', audit: 'club.unsuspended', role: 'superadmin' },
}

export async function applyLifecycleAction(
  action: LifecycleAction,
  clubId: string,
  actorId: string,
  role: PlatformRole,
  note: string | null,
) {
  const transition = LIFECYCLE_TRANSITIONS[action]
  if (transition.role === 'superadmin' && role !== 'superadmin') {
    throw new ForbiddenError('You do not have permission to perform this action')
  }

  const club = await requireVisibleClub(clubId, role)
  if (club.status !== transition.from) {
    throw new ConflictError(`A club in status ${club.status} cannot be moved to ${transition.to}`)
  }

  // Compare-and-set on the expected status: a concurrent review makes this 409 instead of overwriting it.
  const updated = await clubAdminRepository.transitionStatus(clubId, [transition.from], transition.to)
  if (!updated) throw new ConflictError('The application status changed, reload and try again')

  try {
    await clubAdminRepository.insertStatusHistory({
      clubId,
      actorId,
      fromStatus: transition.from,
      toStatus: transition.to,
      note,
    })
  } catch (err) {
    logger.error({ err, clubId, to: transition.to }, '[platform] failed to record status history')
  }
  await recordAudit({
    actorId,
    clubId,
    action: transition.audit,
    entity: 'club',
    entityId: clubId,
    metadata: { from: transition.from, to: transition.to, note },
  })
  // Fire-and-forget: the mail never delays nor fails the review (it never throws).
  void notifyApplicationStatusChange({ clubId, fromStatus: transition.from, toStatus: transition.to, note })
  return updated
}
