import { NotFoundError, AppError } from '../../types/errors'
import { recordAudit } from '../audit/audit.service'
import * as platformRepository from '../platform/platform.repository'
import * as paymentRepository from './payment.repository'
import {
  REFUND_LIMITS_SETTING_KEY,
  clampPolicy,
  normalizeLimits,
  normalizePolicy,
  policyViolations,
  type EffectiveRefundPolicy,
  type RefundLimits,
  type RefundPolicy,
} from './refund-policy.core'

// Card #76: reading and writing the refund policy of a club and the platform
// limits it must respect. The refund itself is `payment.service.ts`.

/** Platform limits (`platform_settings.refund_policy_minimums`); defaults when the row is missing. */
export async function getRefundLimits(): Promise<RefundLimits> {
  const row = await platformRepository.findPlatformSetting(REFUND_LIMITS_SETTING_KEY)
  return normalizeLimits(row?.value)
}

/**
 * The policy that applies to a club's cancellations. A club that does not
 * exist (or a payment without a club) gets the defaults of today: 24 hours, 0%.
 */
export async function resolveEffectivePolicy(clubId: string | null): Promise<EffectiveRefundPolicy> {
  const [row, limits] = await Promise.all([
    clubId ? paymentRepository.findClubRefundPolicyRow(clubId) : Promise.resolve(null),
    getRefundLimits(),
  ])
  const stored = normalizePolicy(row)
  const { policy, clamped } = clampPolicy(stored, limits)
  return { policy, stored, limits, clamped }
}

// ---- Club panel --------------------------------------------------------------------------

export interface ClubRefundPolicyView {
  /** What the club stored. */
  hours_before_start: number
  late_refund_percent: number
  /** What applies to players today (the stored policy clamped to the platform limits). */
  effective: RefundPolicy
  /** true when the stored policy violates the current platform limits and `effective` differs from it. */
  clamped: boolean
  limits: RefundLimits
}

function toView(effective: EffectiveRefundPolicy): ClubRefundPolicyView {
  return {
    hours_before_start: effective.stored.hours_before_start,
    late_refund_percent: effective.stored.late_refund_percent,
    effective: effective.policy,
    clamped: effective.clamped,
    limits: effective.limits,
  }
}

export async function getClubRefundPolicy(clubId: string): Promise<ClubRefundPolicyView> {
  const row = await paymentRepository.findClubRefundPolicyRow(clubId)
  if (!row) throw new NotFoundError('Club')
  return toView(await resolveEffectivePolicy(clubId))
}

export async function setClubRefundPolicy(
  actorId: string,
  clubId: string,
  input: RefundPolicy,
): Promise<ClubRefundPolicyView> {
  const before = await paymentRepository.findClubRefundPolicyRow(clubId)
  if (!before) throw new NotFoundError('Club')

  const limits = await getRefundLimits()
  const violations = policyViolations(input, limits)
  if (violations.length > 0) {
    throw new AppError(
      'The refund policy is outside the limits set by the platform',
      409,
      'POLICY_BELOW_PLATFORM_MINIMUM',
      { limits, requested: input, violations },
    )
  }

  const storedBefore = normalizePolicy(before)
  const changed =
    storedBefore.hours_before_start !== input.hours_before_start ||
    storedBefore.late_refund_percent !== input.late_refund_percent
  if (changed) {
    const updated = await paymentRepository.updateClubRefundPolicy(clubId, input)
    if (!updated) throw new NotFoundError('Club')
    await recordAudit({
      actorId,
      clubId,
      action: 'club.refund_policy_changed',
      entity: 'club',
      entityId: clubId,
      metadata: { before: storedBefore, after: input },
    })
  }
  return toView(await resolveEffectivePolicy(clubId))
}

// ---- Platform (superadmin) -------------------------------------------------------------------

export interface PlatformRefundLimitsView extends RefundLimits {
  /** Clubs whose stored policy is outside these limits (their effective policy is clamped). */
  clubs_clamped: number
  updated_at: string | null
  updated_by: string | null
}

async function limitsView(limits: RefundLimits, meta: { updated_at: string | null; updated_by: string | null }): Promise<PlatformRefundLimitsView> {
  return {
    ...limits,
    clubs_clamped: await paymentRepository.countClubsOutsideLimits(limits),
    updated_at: meta.updated_at,
    updated_by: meta.updated_by,
  }
}

export async function getPlatformRefundLimits(): Promise<PlatformRefundLimitsView> {
  const row = await platformRepository.findPlatformSetting(REFUND_LIMITS_SETTING_KEY)
  return limitsView(normalizeLimits(row?.value), {
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  })
}

/**
 * Sets the platform limits. It never rewrites a club's stored policy: a club
 * outside the new limits is clamped when a refund is evaluated and is flagged
 * (`clamped`) on its own read endpoint.
 */
export async function setPlatformRefundLimits(actorId: string, input: RefundLimits): Promise<PlatformRefundLimitsView> {
  const existing = await platformRepository.findPlatformSetting(REFUND_LIMITS_SETTING_KEY)
  const before = normalizeLimits(existing?.value)
  const changed =
    before.max_hours_before_start !== input.max_hours_before_start ||
    before.min_late_refund_percent !== input.min_late_refund_percent || !existing

  if (!changed && existing) {
    return limitsView(before, { updated_at: existing.updated_at, updated_by: existing.updated_by })
  }

  const row = await platformRepository.upsertPlatformSetting(
    REFUND_LIMITS_SETTING_KEY,
    { max_hours_before_start: input.max_hours_before_start, min_late_refund_percent: input.min_late_refund_percent },
    actorId,
  )
  await recordAudit({
    actorId,
    clubId: null,
    action: 'platform.refund_policy_limits_changed',
    entity: 'platform_settings',
    entityId: REFUND_LIMITS_SETTING_KEY,
    metadata: { before, after: input },
  })
  return limitsView(normalizeLimits(row.value), { updated_at: row.updated_at, updated_by: row.updated_by })
}

// ---- Player-facing ------------------------------------------------------------------------------

export interface PublicRefundPolicy {
  hours_before_start: number
  late_refund_percent: number
}

/** What a player sees before paying: the policy that will apply (already clamped). */
export async function getPublicRefundPolicy(clubId: string): Promise<PublicRefundPolicy> {
  const { policy } = await resolveEffectivePolicy(clubId)
  return { hours_before_start: policy.hours_before_start, late_refund_percent: policy.late_refund_percent }
}
