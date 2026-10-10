import { randomUUID } from 'crypto'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../types/errors'
import type { ClubStatus } from '../../types/access'
import { buildMeta } from '../../lib/pagination'
import { logger } from '../../lib/logger'
import { recordAudit } from '../audit/audit.service'
import * as repository from './club-admin.repository'
import type { ReservationStatus } from './club-admin.repository'
import type {
  CreateCourtInput,
  CreateMyClubInput,
  UpdateClubInput,
  UpdateCourtInput,
  UploadDocumentBody,
} from './club-admin.validator'
import { OPENING_HOURS_DAYS } from './club-admin.validator'

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

// Card #67: statuses in which the club's data, courts and documents can change.
const EDITABLE_STATUSES: readonly ClubStatus[] = ['draft', 'changes_requested', 'approved']

const NOT_EDITABLE_MESSAGES: Partial<Record<ClubStatus, string>> = {
  pending: 'The application is under review and cannot be edited until the review finishes',
  rejected: 'The application was rejected and cannot be edited',
  suspended: 'The club is suspended and cannot be edited',
}

export function isEditableStatus(status: ClubStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}

function assertEditable(club: repository.ClubRow): void {
  if (!isEditableStatus(club.status)) {
    throw new ConflictError(NOT_EDITABLE_MESSAGES[club.status] ?? 'The club cannot be edited in its current state')
  }
}

async function requireEditableClub(clubId: string): Promise<repository.ClubRow> {
  const club = await requireClub(clubId)
  assertEditable(club)
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
  const before = await requireEditableClub(clubId)
  const updated = await repository.updateClub(clubId, patch)
  if (!updated) throw new NotFoundError('Club')

  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(patch) as Array<keyof UpdateClubInput>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(updated[key])) {
      changes[key] = { from: before[key], to: updated[key] }
    }
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

// ---- Card #67: club creation from the panel ---------------------------------

const MAX_DRAFT_CLUBS_PER_USER = 10
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug.length >= 2 ? slug : 'club'
}

function slugSuffix(): string {
  return randomUUID().replace(/-/g, '').slice(0, 5)
}

/**
 * Creates a club in `draft` owned by the caller. Idempotent for retries: a
 * second call with the same name, address and city while that draft still
 * exists returns the existing club (`created: false`).
 */
export async function createMyClub(
  userId: string,
  input: CreateMyClubInput,
): Promise<{ club: repository.ClubRow; created: boolean }> {
  const drafts = await repository.listOwnedDrafts(userId)
  const same = drafts.find(
    (d) =>
      d.name.trim().toLowerCase() === input.name.toLowerCase() &&
      d.address.trim().toLowerCase() === input.address.toLowerCase() &&
      d.city.trim().toLowerCase() === input.city.toLowerCase(),
  )
  if (same) return { club: await requireClub(same.id), created: false }

  if (drafts.length >= MAX_DRAFT_CLUBS_PER_USER) {
    throw new ConflictError(
      `You already have ${MAX_DRAFT_CLUBS_PER_USER} club applications in draft; finish or submit one first`,
    )
  }

  const base = slugify(input.name)
  let club: repository.ClubRow | null = null
  for (let attempt = 0; attempt < 5 && !club; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${slugSuffix()}`
    try {
      club = await repository.insertDraftClub({ ...input, slug })
    } catch (err) {
      if (errorCode(err) !== UNIQUE_VIOLATION) throw err
    }
  }
  if (!club) throw new ConflictError('Could not generate a unique slug for the club, try a different name')

  try {
    await repository.insertOwner(club.id, userId)
  } catch (err) {
    // Do not leave a club nobody can administer.
    try {
      await repository.deleteClub(club.id)
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr, clubId: club.id }, '[club-admin] failed to roll back club creation')
    }
    throw new AppError('Could not assign the club owner', 500, 'INTERNAL_ERROR')
  }

  await recordStatusChange({ clubId: club.id, actorId: userId, from: null, to: 'draft', note: null })
  await recordAudit({
    actorId: userId,
    clubId: club.id,
    action: 'club.created',
    entity: 'club',
    entityId: club.id,
    metadata: { name: club.name, slug: club.slug, source: 'onboarding', status: 'draft' },
  })
  return { club, created: true }
}

/** Status history entry; a failure is logged and never fails the operation that already happened. */
export async function recordStatusChange(input: {
  clubId: string
  actorId: string | null
  from: ClubStatus | null
  to: ClubStatus
  note: string | null
}): Promise<void> {
  try {
    await repository.insertStatusHistory({
      clubId: input.clubId,
      actorId: input.actorId,
      fromStatus: input.from,
      toStatus: input.to,
      note: input.note,
    })
  } catch (err) {
    logger.error({ err, clubId: input.clubId, to: input.to }, '[club-admin] failed to record status history')
  }
}

// ---- Courts -----------------------------------------------------------------

export async function listCourts(clubId: string) {
  await requireClub(clubId)
  return repository.listCourts(clubId)
}

export async function createCourt(clubId: string, actorId: string, input: CreateCourtInput) {
  await requireEditableClub(clubId)
  const court = await repository.insertCourt(clubId, input)
  await recordAudit({
    actorId,
    clubId,
    action: 'court.created',
    entity: 'court',
    entityId: court.id,
    metadata: { name: court.name, surface: court.surface, price_per_hour: court.price_per_hour },
  })
  return court
}

export async function updateCourt(clubId: string, courtId: string, actorId: string, patch: UpdateCourtInput) {
  await requireEditableClub(clubId)
  const before = await repository.findCourtInClub(clubId, courtId)
  if (!before) throw new NotFoundError('Court')
  const updated = await repository.updateCourt(courtId, patch)
  if (!updated) throw new NotFoundError('Court')

  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(patch) as Array<keyof UpdateCourtInput>) {
    if (before[key] !== updated[key]) changes[key] = { from: before[key], to: updated[key] }
  }
  await recordAudit({
    actorId,
    clubId,
    action: 'court.updated',
    entity: 'court',
    entityId: courtId,
    metadata: { changes },
  })
  return updated
}

export async function deleteCourt(clubId: string, courtId: string, actorId: string) {
  await requireEditableClub(clubId)
  const court = await repository.findCourtInClub(clubId, courtId)
  if (!court) throw new NotFoundError('Court')

  const inUse = new ConflictError(
    'This court has reservations and cannot be deleted; deactivate it instead (PATCH is_active: false)',
  )
  if ((await repository.countCourtReservations(courtId)) > 0) throw inUse
  try {
    await repository.deleteCourt(courtId)
  } catch (err) {
    if (errorCode(err) === FOREIGN_KEY_VIOLATION) throw inUse
    throw err
  }
  await recordAudit({
    actorId,
    clubId,
    action: 'court.deleted',
    entity: 'court',
    entityId: courtId,
    metadata: { name: court.name },
  })
  return { id: courtId }
}

// ---- Documents --------------------------------------------------------------

const DOCUMENT_URL_TTL_SECONDS = repository.DOCUMENT_URL_TTL_SECONDS
const MAX_DOCUMENTS_PER_CLUB = 20

export interface DocumentView {
  id: string
  kind: repository.DocumentKind
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
  url: string | null
}

async function toDocumentView(doc: repository.DocumentRow, withUrl = true): Promise<DocumentView> {
  return {
    id: doc.id,
    kind: doc.kind,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    size_bytes: doc.size_bytes,
    uploaded_by: doc.uploaded_by,
    created_at: doc.created_at,
    url: withUrl ? await repository.signDocumentUrl(doc.file_path, DOCUMENT_URL_TTL_SECONDS) : null,
  }
}

/** `<clubId>/<uuid>-<safe filename>`: the original name never reaches the storage key unsanitized. */
export function buildDocumentPath(clubId: string, fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : ''
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80)
  return `${clubId}/${randomUUID()}-${stem || 'document'}${ext ? `.${ext}` : ''}`
}

/** Checks the file's magic bytes so the declared mime type cannot be spoofed. */
export function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('latin1') === '%PDF-'
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/webp':
      return buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP'
    default:
      return false
  }
}

export async function uploadDocument(
  clubId: string,
  actorId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  body: UploadDocumentBody,
): Promise<DocumentView> {
  await requireEditableClub(clubId)
  if (!matchesDeclaredType(file.buffer, file.mimetype)) {
    throw new ValidationError('The file content does not match its type')
  }
  const existing = await repository.listDocuments(clubId)
  if (existing.length >= MAX_DOCUMENTS_PER_CLUB) {
    throw new ConflictError(`A club can have at most ${MAX_DOCUMENTS_PER_CLUB} documents`)
  }

  // multer decodes the multipart filename as latin1; restore the UTF-8 name.
  const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200)
  const path = buildDocumentPath(clubId, fileName)
  await repository.uploadDocumentFile(path, file.buffer, file.mimetype)

  let doc: repository.DocumentRow
  try {
    doc = await repository.insertDocument({
      club_id: clubId,
      uploaded_by: actorId,
      kind: body.kind,
      file_path: path,
      file_name: fileName,
      mime_type: file.mimetype,
      size_bytes: file.size,
    })
  } catch (err) {
    try {
      await repository.removeDocumentFile(path)
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr, path }, '[club-admin] failed to remove orphan document file')
    }
    throw err
  }

  await recordAudit({
    actorId,
    clubId,
    action: 'club.document_uploaded',
    entity: 'club_document',
    entityId: doc.id,
    metadata: { kind: doc.kind, file_name: doc.file_name, size_bytes: doc.size_bytes },
  })
  return toDocumentView(doc)
}

export async function deleteDocument(clubId: string, documentId: string, actorId: string) {
  await requireEditableClub(clubId)
  const doc = await repository.findDocumentInClub(clubId, documentId)
  if (!doc) throw new NotFoundError('Document')
  await repository.removeDocumentFile(doc.file_path)
  await repository.deleteDocumentRow(doc.id)
  await recordAudit({
    actorId,
    clubId,
    action: 'club.document_deleted',
    entity: 'club_document',
    entityId: doc.id,
    metadata: { kind: doc.kind, file_name: doc.file_name },
  })
  return { id: doc.id }
}

/** Signed URL for one document. Used by the club panel and by the platform reviewers. */
export async function getDocumentUrl(clubId: string, documentId: string) {
  const doc = await repository.findDocumentInClub(clubId, documentId)
  if (!doc) throw new NotFoundError('Document')
  const url = await repository.signDocumentUrl(doc.file_path, DOCUMENT_URL_TTL_SECONDS)
  if (!url) throw new AppError('Could not generate the document URL', 500, 'INTERNAL_ERROR')
  return { url, expiresIn: DOCUMENT_URL_TTL_SECONDS }
}

// ---- Onboarding -------------------------------------------------------------

export type OnboardingStepKey = 'club' | 'location' | 'contact' | 'courts' | 'schedule' | 'documents'

export interface OnboardingStep {
  key: OnboardingStepKey
  complete: boolean
  missing: string[]
}

function blank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0
}

/** Pure: which parts of the application are complete. Drives both the onboarding view and `submit`. */
export function evaluateSteps(
  club: repository.ClubRow,
  courts: repository.CourtRow[],
  documentsCount: number,
): OnboardingStep[] {
  const step = (key: OnboardingStepKey, missing: string[]): OnboardingStep => ({
    key,
    complete: missing.length === 0,
    missing,
  })

  const hasHours = OPENING_HOURS_DAYS.some((day) => (club.opening_hours[day]?.length ?? 0) > 0)

  return [
    step('club', [
      ...(blank(club.name) ? ['name'] : []),
      ...(blank(club.legal_name) ? ['legal_name'] : []),
      ...(blank(club.tax_id) ? ['tax_id'] : []),
    ]),
    step('location', [
      ...(blank(club.address) ? ['address'] : []),
      ...(blank(club.city) ? ['city'] : []),
      ...(club.lat === null || club.lng === null ? ['coordinates'] : []),
    ]),
    step('contact', [...(blank(club.phone) ? ['phone'] : []), ...(blank(club.email) ? ['email'] : [])]),
    step('courts', courts.some((c) => c.is_active && c.price_per_hour > 0) ? [] : ['active_court_with_price']),
    step('schedule', hasHours ? [] : ['opening_hours']),
    step('documents', documentsCount > 0 ? [] : ['document']),
  ]
}

export function canSubmitFrom(status: ClubStatus, steps: OnboardingStep[]): boolean {
  return (status === 'draft' || status === 'changes_requested') && steps.every((s) => s.complete)
}

export async function getOnboarding(clubId: string) {
  const club = await requireClub(clubId)
  const [courts, documents, history] = await Promise.all([
    repository.listCourts(clubId),
    repository.listDocuments(clubId),
    repository.listStatusHistory(clubId),
  ])
  const steps = evaluateSteps(club, courts, documents.length)
  return {
    status: club.status,
    steps,
    canSubmit: canSubmitFrom(club.status, steps),
    history,
    documents: await Promise.all(documents.map((doc) => toDocumentView(doc))),
  }
}

export async function submitApplication(clubId: string, actorId: string) {
  const club = await requireClub(clubId)
  if (club.status !== 'draft' && club.status !== 'changes_requested') {
    throw new ConflictError(
      club.status === 'pending'
        ? 'The application was already submitted and is under review'
        : `A club in status ${club.status} cannot be submitted`,
    )
  }

  const [courts, documents] = await Promise.all([repository.listCourts(clubId), repository.listDocuments(clubId)])
  const steps = evaluateSteps(club, courts, documents.length)
  if (!steps.every((s) => s.complete)) {
    const missing = steps.flatMap((s) => s.missing.map((field) => `${s.key}.${field}`))
    throw new AppError('The application is incomplete', 422, 'APPLICATION_INCOMPLETE', { missing, steps })
  }

  const updated = await repository.transitionStatus(clubId, ['draft', 'changes_requested'], 'pending')
  if (!updated) throw new ConflictError('The application status changed, reload and try again')

  await recordStatusChange({ clubId, actorId, from: club.status, to: 'pending', note: null })
  await recordAudit({
    actorId,
    clubId,
    action: 'club.submitted',
    entity: 'club',
    entityId: clubId,
    metadata: { from: club.status, to: 'pending' },
  })
  return updated
}
