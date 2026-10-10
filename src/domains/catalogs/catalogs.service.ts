import { randomUUID } from 'node:crypto'
import { AppError, NotFoundError, ValidationError } from '../../types/errors'
import { buildMeta } from '../../lib/pagination'
import { extensionFor, matchesImageSignature, type ImageMimeType, IMAGE_MIME_TYPES } from '../../lib/image-signature'
import { recordAudit } from '../audit/audit.service'
import * as repository from './catalogs.repository'
import type { AchievementRow, CatalogTable, ChallengeRow, CosmeticRow } from './catalogs.repository'
import type {
  CreateAchievementInput,
  CreateChallengeInput,
  CreateCosmeticInput,
  ListAchievementsQuery,
  ListChallengesQuery,
  ListCosmeticsQuery,
  UpdateAchievementInput,
  UpdateChallengeInput,
  UpdateCosmeticInput,
} from './catalogs.validator'

const UNIQUE_VIOLATION = '23505'

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
}

// ---- Pure helpers (unit-testable without a database) -----------------------

/** Pure: the fields of `patch` whose value differs from `current`, as { before, after }. */
export function diffFields(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (JSON.stringify(current[key]) === JSON.stringify(value)) continue
    before[key] = current[key]
    after[key] = value
  }
  return { before, after }
}

/** Pure: fields that cannot change once players have progress/ownership on the item. */
export const LOCKED_WHEN_IN_USE: Record<CatalogTable, readonly string[]> = {
  achievements: [],
  challenges: ['cadence', 'action_type'],
  cosmetics: ['type'],
}

/** Pure: which of the changed fields are locked given whether the item is in use. */
export function lockedFields(table: CatalogTable, changed: string[], inUse: boolean): string[] {
  if (!inUse) return []
  return changed.filter((field) => LOCKED_WHEN_IN_USE[table].includes(field))
}

export function buildAssetPath(mimeType: ImageMimeType, id: string = randomUUID()): string {
  return `${id}.${extensionFor(mimeType)}`
}

// ---- Shared flows ----------------------------------------------------------

interface Row {
  id: string
  code: string
  is_active: boolean
}

interface EntityConfig {
  table: CatalogTable
  /** Audit entity and action prefix: `catalog.<entity>_created`. */
  entity: 'achievement' | 'challenge' | 'cosmetic'
  label: string
  usage: (id: string) => Promise<Record<string, number>>
}

const ACHIEVEMENTS: EntityConfig = {
  table: 'achievements',
  entity: 'achievement',
  label: 'Achievement',
  usage: async (id) => ({ owners_count: await repository.countAchievementOwners(id) }),
}

const CHALLENGES: EntityConfig = {
  table: 'challenges',
  entity: 'challenge',
  label: 'Challenge',
  usage: async (id) => {
    const [assignments_count, active_assignments_count] = await Promise.all([
      repository.countChallengeAssignments(id),
      repository.countChallengeActiveAssignments(id),
    ])
    return { assignments_count, active_assignments_count }
  },
}

const COSMETICS: EntityConfig = {
  table: 'cosmetics',
  entity: 'cosmetic',
  label: 'Cosmetic',
  usage: async (id) => ({ owners_count: await repository.countCosmeticOwners(id) }),
}

async function listOf<T>(
  config: EntityConfig,
  filters: repository.ListFilters,
): Promise<{ data: T[]; meta: ReturnType<typeof buildMeta> }> {
  const { data, total } = await repository.list<T>(config.table, filters)
  return { data, meta: buildMeta(filters.page, filters.limit, total) }
}

async function detailOf<T extends Row>(config: EntityConfig, row: T) {
  return { ...row, usage: await config.usage(row.id) }
}

async function getOf<T extends Row>(config: EntityConfig, id: string) {
  const row = await repository.findById<T>(config.table, id)
  if (!row) throw new NotFoundError(config.label)
  return detailOf(config, row)
}

async function createOf<T extends Row>(config: EntityConfig, actorId: string, input: Record<string, unknown>) {
  let row: T
  try {
    row = await repository.insert<T>(config.table, input)
  } catch (err) {
    if (errorCode(err) === UNIQUE_VIOLATION) {
      throw new AppError(`A ${config.entity} with code "${String(input.code)}" already exists`, 409, 'CODE_ALREADY_EXISTS')
    }
    throw err
  }
  await recordAudit({
    actorId,
    action: `catalog.${config.entity}_created`,
    entity: config.entity,
    entityId: row.id,
    metadata: { code: row.code, before: null, after: row },
  })
  return detailOf(config, row)
}

async function updateOf<T extends Row>(config: EntityConfig, actorId: string, id: string, patch: Record<string, unknown>) {
  const current = await repository.findById<T>(config.table, id)
  if (!current) throw new NotFoundError(config.label)

  const { before, after } = diffFields(current as unknown as Record<string, unknown>, patch)
  const changed = Object.keys(after)
  if (changed.length === 0) return detailOf(config, current) // nothing to write, nothing to audit

  const usage = await config.usage(id)
  const inUse = Object.values(usage).some((count) => count > 0)
  const locked = lockedFields(config.table, changed, inUse)
  if (locked.length > 0) {
    throw new AppError(
      `${locked.join(', ')} cannot be changed once players have progress or own this ${config.entity}`,
      409,
      'CATALOG_FIELD_LOCKED',
      { fields: locked, usage },
    )
  }

  const updated = await repository.update<T>(config.table, id, after)
  if (!updated) throw new NotFoundError(config.label)
  await recordAudit({
    actorId,
    action: `catalog.${config.entity}_updated`,
    entity: config.entity,
    entityId: id,
    metadata: { code: current.code, before, after },
  })
  return detailOf(config, updated)
}

async function setActiveOf<T extends Row>(config: EntityConfig, actorId: string, id: string, isActive: boolean) {
  const current = await repository.findById<T>(config.table, id)
  if (!current) throw new NotFoundError(config.label)
  if (current.is_active === isActive) return detailOf(config, current) // idempotent

  const updated = await repository.update<T>(config.table, id, { is_active: isActive })
  if (!updated) throw new NotFoundError(config.label)
  await recordAudit({
    actorId,
    action: `catalog.${config.entity}_${isActive ? 'activated' : 'deactivated'}`,
    entity: config.entity,
    entityId: id,
    metadata: { code: current.code, before: { is_active: current.is_active }, after: { is_active: isActive } },
  })
  return detailOf(config, updated)
}

function equalsOf(query: Record<string, unknown>, keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, query[key] as string | undefined]))
}

// ---- Achievements ----------------------------------------------------------

export const listAchievements = (q: ListAchievementsQuery) => listOf<AchievementRow>(ACHIEVEMENTS, q)
export const getAchievement = (id: string) => getOf<AchievementRow>(ACHIEVEMENTS, id)
export const createAchievement = (actorId: string, input: CreateAchievementInput) =>
  createOf<AchievementRow>(ACHIEVEMENTS, actorId, input)
export const updateAchievement = (actorId: string, id: string, input: UpdateAchievementInput) =>
  updateOf<AchievementRow>(ACHIEVEMENTS, actorId, id, input)
export const setAchievementActive = (actorId: string, id: string, isActive: boolean) =>
  setActiveOf<AchievementRow>(ACHIEVEMENTS, actorId, id, isActive)

// ---- Challenges ------------------------------------------------------------

export const listChallenges = (q: ListChallengesQuery) =>
  listOf<ChallengeRow>(CHALLENGES, { ...q, equals: equalsOf(q, ['cadence', 'action_type']) })
export const getChallenge = (id: string) => getOf<ChallengeRow>(CHALLENGES, id)
export const createChallenge = (actorId: string, input: CreateChallengeInput) =>
  createOf<ChallengeRow>(CHALLENGES, actorId, input)
export const updateChallenge = (actorId: string, id: string, input: UpdateChallengeInput) =>
  updateOf<ChallengeRow>(CHALLENGES, actorId, id, input)
export const setChallengeActive = (actorId: string, id: string, isActive: boolean) =>
  setActiveOf<ChallengeRow>(CHALLENGES, actorId, id, isActive)

// ---- Cosmetics -------------------------------------------------------------

export const listCosmetics = (q: ListCosmeticsQuery) =>
  listOf<CosmeticRow>(COSMETICS, { ...q, equals: equalsOf(q, ['type']) })
export const getCosmetic = (id: string) => getOf<CosmeticRow>(COSMETICS, id)
export const createCosmetic = (actorId: string, input: CreateCosmeticInput) =>
  createOf<CosmeticRow>(COSMETICS, actorId, input)
export const updateCosmetic = (actorId: string, id: string, input: UpdateCosmeticInput) =>
  updateOf<CosmeticRow>(COSMETICS, actorId, id, input)
export const setCosmeticActive = (actorId: string, id: string, isActive: boolean) =>
  setActiveOf<CosmeticRow>(COSMETICS, actorId, id, isActive)

// ---- Images ----------------------------------------------------------------

export interface UploadedAsset {
  url: string
  path: string
  content_type: string
  size_bytes: number
}

export async function uploadAsset(
  actorId: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<UploadedAsset> {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new ValidationError('Image must be a JPEG, PNG or WebP file')
  }
  if (!matchesImageSignature(file.buffer, file.mimetype)) {
    throw new ValidationError('The file content does not match its type')
  }
  const path = buildAssetPath(file.mimetype as ImageMimeType)
  const url = await repository.uploadAsset(path, file.buffer, file.mimetype)
  await recordAudit({
    actorId,
    action: 'catalog.asset_uploaded',
    entity: 'catalog_asset',
    metadata: { path, url, content_type: file.mimetype, size_bytes: file.size },
  })
  return { url, path, content_type: file.mimetype, size_bytes: file.size }
}
