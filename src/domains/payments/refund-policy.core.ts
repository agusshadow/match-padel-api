// Card #76: refund policy per club within platform limits. Pure logic with its
// collaborators injected (like charging.core.ts), so it can be checked without a
// database or Mercado Pago. `payment.service.ts` wires the real ones.
//
// Rule (decided by the product owner): a player who cancels AT LEAST
// `hours_before_start` before the start gets 100% of what they paid; inside that
// window they get `late_refund_percent` of it, in money, from the club's account;
// once the start has passed they get nothing. The platform limits protect
// players: the cutoff may not exceed `max_hours_before_start` and the late
// percentage may not be below `min_late_refund_percent`.
//
// Partial refunds through Mercado Pago are NOT verified against the sandbox
// (card #73): docs/mercadopago.md, "Refunds".

export interface RefundPolicy {
  /** Cutoff, in hours before the start (0..720). */
  hours_before_start: number
  /** Share of the paid amount refunded inside the cutoff window (0..100, 2 decimals). */
  late_refund_percent: number
}

export interface RefundLimits {
  /** Highest cutoff a club may set (0..720). */
  max_hours_before_start: number
  /** Lowest late refund a club may set (0..100). */
  min_late_refund_percent: number
}

/** What every club had before this card: a 24 hour cutoff and no real money back after it. */
export const DEFAULT_REFUND_POLICY: RefundPolicy = { hours_before_start: 24, late_refund_percent: 0 }
export const DEFAULT_REFUND_LIMITS: RefundLimits = { max_hours_before_start: 48, min_late_refund_percent: 0 }

export const MAX_REFUND_HOURS = 720
export const REFUND_LIMITS_SETTING_KEY = 'refund_policy_minimums'

export type RefundReason = 'before_cutoff' | 'late_window' | 'after_start'

export interface RefundComputation {
  /** 0..100. */
  percent: number
  /** Money to return, 2 decimals (never above what was paid). */
  amount: number
  reason: RefundReason
}

// ---- Limits and policy -------------------------------------------------------------

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Reads the stored `platform_settings` value defensively: anything missing or out of range falls back to the default. */
export function normalizeLimits(raw: unknown): RefundLimits {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const hours = toNumber(obj.max_hours_before_start)
  const percent = toNumber(obj.min_late_refund_percent)
  return {
    max_hours_before_start:
      hours !== null && hours >= 0 && hours <= MAX_REFUND_HOURS
        ? Math.floor(hours)
        : DEFAULT_REFUND_LIMITS.max_hours_before_start,
    min_late_refund_percent:
      percent !== null && percent >= 0 && percent <= 100
        ? round2(percent)
        : DEFAULT_REFUND_LIMITS.min_late_refund_percent,
  }
}

/** Reads the columns of a club defensively (a missing value is the default policy of today). */
export function normalizePolicy(raw: { refund_hours_before_start?: unknown; refund_late_percent?: unknown } | null): RefundPolicy {
  const hours = toNumber(raw?.refund_hours_before_start)
  const percent = toNumber(raw?.refund_late_percent)
  return {
    hours_before_start:
      hours !== null && hours >= 0 && hours <= MAX_REFUND_HOURS
        ? Math.floor(hours)
        : DEFAULT_REFUND_POLICY.hours_before_start,
    late_refund_percent:
      percent !== null && percent >= 0 && percent <= 100
        ? round2(percent)
        : DEFAULT_REFUND_POLICY.late_refund_percent,
  }
}

/** Violations of the platform limits, empty when the policy is acceptable. */
export function policyViolations(policy: RefundPolicy, limits: RefundLimits): Array<'hours_before_start' | 'late_refund_percent'> {
  const violations: Array<'hours_before_start' | 'late_refund_percent'> = []
  if (policy.hours_before_start > limits.max_hours_before_start) violations.push('hours_before_start')
  if (policy.late_refund_percent < limits.min_late_refund_percent) violations.push('late_refund_percent')
  return violations
}

/** The policy that actually applies: a stored policy that breaks the current limits is brought inside them. */
export function clampPolicy(policy: RefundPolicy, limits: RefundLimits): { policy: RefundPolicy; clamped: boolean } {
  const effective: RefundPolicy = {
    hours_before_start: Math.min(policy.hours_before_start, limits.max_hours_before_start),
    late_refund_percent: Math.max(policy.late_refund_percent, limits.min_late_refund_percent),
  }
  return {
    policy: effective,
    clamped:
      effective.hours_before_start !== policy.hours_before_start ||
      effective.late_refund_percent !== policy.late_refund_percent,
  }
}

// ---- Engine ---------------------------------------------------------------------------

export interface ComputeRefundInput {
  /** What the player paid, currency units. */
  amountPaid: number
  startsAt: Date | string
  cancelledAt: Date | string
  policy: RefundPolicy
  /** When given, the policy is clamped to them first (what a stored policy gets at evaluation time). */
  limits?: RefundLimits
}

/**
 * Pure. Cutoff is inclusive: cancelling exactly `hours_before_start` before the
 * start still gets 100% (the 24h rule that matches had before this card).
 * At or after the start nothing is refunded. Amounts are computed in integer
 * cents and rounded half up.
 */
export function computeRefund(input: ComputeRefundInput): RefundComputation {
  const policy = input.limits ? clampPolicy(input.policy, input.limits).policy : input.policy
  const paidCents = Number.isFinite(input.amountPaid) && input.amountPaid > 0 ? Math.round(input.amountPaid * 100) : 0

  const startMs = new Date(input.startsAt).getTime()
  const cancelMs = new Date(input.cancelledAt).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(cancelMs)) {
    throw new Error('computeRefund: invalid date')
  }

  if (cancelMs >= startMs) {
    return { percent: 0, amount: 0, reason: 'after_start' }
  }

  const cutoffMs = policy.hours_before_start * 3_600_000
  if (startMs - cancelMs >= cutoffMs) {
    return { percent: 100, amount: paidCents / 100, reason: 'before_cutoff' }
  }

  const percent = Math.min(100, Math.max(0, round2(policy.late_refund_percent)))
  const hundredths = Math.round(percent * 100) // 12.5% -> 1250
  const refundCents = Math.min(paidCents, Math.floor((paidCents * hundredths + 5000) / 10000))
  return { percent, amount: refundCents / 100, reason: 'late_window' }
}

// ---- Orchestration ----------------------------------------------------------------------

export interface EffectiveRefundPolicy {
  /** The policy that applies (clamped to the limits). */
  policy: RefundPolicy
  /** What the club stored. */
  stored: RefundPolicy
  limits: RefundLimits
  clamped: boolean
}

export interface PolicyRefundPayment {
  id: string
  user_id: string
  /** What this payment charged. */
  amount: number
}

export type PolicyRefundStatus = 'refunded' | 'partial' | 'none' | 'pending'

export interface PolicyRefundOutcome {
  payment_id: string
  user_id: string
  paid: number
  percent: number
  /** Amount the policy says to return. */
  amount: number
  reason: RefundReason
  /**
   * `refunded` = the whole payment went back; `partial` = part of it; `none` = nothing is owed
   * (0% or after the start); `pending` = money is owed but the refund could not be completed.
   */
  status: PolicyRefundStatus
  /** Money actually returned (0 for `none` and `pending`). */
  amount_refunded: number
  error: string | null
}

export interface PolicyRefundSummary {
  club_id: string | null
  policy: RefundPolicy
  reason: RefundReason
  percent: number
  payments: number
  /** Payments where money actually went back (refunded or partial). */
  refunded: number
  /** Payment ids whose refund is owed but could not be completed. */
  pending: string[]
  amount_refunded: number
  /** Money owed that could not be returned yet. */
  amount_pending: number
  outcomes: PolicyRefundOutcome[]
}

export type AttemptRefundResult = { ok: true } | { ok: false; error: string }

export interface RefundRecord {
  refund_status: 'none' | 'partial' | 'full' | 'pending' | 'failed'
  refunded_amount: number
  refund_error: string | null
}

export interface RefundPolicyDeps {
  /** Policy and limits of the club (`null` club = platform defaults). Must not throw for a missing club. */
  resolvePolicy(clubId: string | null): Promise<EffectiveRefundPolicy>
  /** One Mercado Pago refund (full when `amount` is omitted). Never throws. */
  attemptRefund(paymentId: string, amount?: number): Promise<AttemptRefundResult>
  recordRefund(paymentId: string, record: RefundRecord): Promise<void>
  /** Tells the club owner(s) that refunds are pending. May throw: the core catches it. */
  notifyRefundPending(input: {
    clubId: string
    startsAt: Date
    outcomes: PolicyRefundOutcome[]
  }): Promise<void>
  now(): Date
  onError(message: string, context: Record<string, unknown>): void
}

export function createRefundPolicyCore(deps: RefundPolicyDeps) {
  /**
   * Refunds each payment of a cancellation according to the club's policy.
   * Never throws for a refund problem: the cancellation must go through, the
   * payment is marked `pending` (with the reason) and the club's owners are told.
   */
  async function refundByPolicy(input: {
    clubId: string | null
    payments: PolicyRefundPayment[]
    startsAt: Date | string
    cancelledAt?: Date
  }): Promise<PolicyRefundSummary> {
    const startsAt = new Date(input.startsAt)
    const cancelledAt = input.cancelledAt ?? deps.now()
    const effective = await deps.resolvePolicy(input.clubId)

    const outcomes: PolicyRefundOutcome[] = []
    for (const payment of input.payments) {
      const paid = round2(Number(payment.amount))
      const computed = computeRefund({
        amountPaid: paid,
        startsAt,
        cancelledAt,
        policy: effective.policy,
      })
      const base = {
        payment_id: payment.id,
        user_id: payment.user_id,
        paid,
        percent: computed.percent,
        amount: computed.amount,
        reason: computed.reason,
      }

      if (computed.amount <= 0) {
        await safeRecord(payment.id, { refund_status: 'none', refunded_amount: 0, refund_error: null })
        outcomes.push({ ...base, status: 'none', amount_refunded: 0, error: null })
        continue
      }

      const isFull = Math.round(computed.amount * 100) >= Math.round(paid * 100)
      // Only a full refund is sent without an amount; a partial one carries it.
      const result = await deps.attemptRefund(payment.id, isFull ? undefined : computed.amount)

      if (result.ok) {
        await safeRecord(payment.id, {
          refund_status: isFull ? 'full' : 'partial',
          refunded_amount: computed.amount,
          refund_error: null,
        })
        outcomes.push({
          ...base,
          status: isFull ? 'refunded' : 'partial',
          amount_refunded: computed.amount,
          error: null,
        })
      } else {
        await safeRecord(payment.id, { refund_status: 'pending', refunded_amount: 0, refund_error: result.error })
        outcomes.push({ ...base, status: 'pending', amount_refunded: 0, error: result.error })
      }
    }

    const pendingOutcomes = outcomes.filter((o) => o.status === 'pending')
    if (pendingOutcomes.length > 0 && input.clubId) {
      try {
        await deps.notifyRefundPending({ clubId: input.clubId, startsAt, outcomes: pendingOutcomes })
      } catch (err) {
        deps.onError('Failed to notify the club of pending refunds', {
          clubId: input.clubId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const returned = outcomes.filter((o) => o.status === 'refunded' || o.status === 'partial')
    const cents = (n: number) => Math.round(n * 100)
    const first = outcomes[0]
    const reference = first ?? computeRefund({ amountPaid: 0, startsAt, cancelledAt, policy: effective.policy })
    return {
      club_id: input.clubId,
      policy: effective.policy,
      reason: reference.reason,
      percent: reference.percent,
      payments: outcomes.length,
      refunded: returned.length,
      pending: pendingOutcomes.map((o) => o.payment_id),
      amount_refunded: returned.reduce((sum, o) => sum + cents(o.amount_refunded), 0) / 100,
      amount_pending: pendingOutcomes.reduce((sum, o) => sum + cents(o.amount), 0) / 100,
      outcomes,
    }
  }

  async function safeRecord(paymentId: string, record: RefundRecord): Promise<void> {
    try {
      await deps.recordRefund(paymentId, record)
    } catch (err) {
      deps.onError('Failed to record the refund state of a payment', {
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { refundByPolicy }
}

export type RefundPolicyCore = ReturnType<typeof createRefundPolicyCore>

// ---- What the API tells the player who cancelled ---------------------------------------------

/**
 * `refund` field of the player-side cancellation responses
 * (`DELETE /matches/:id`, `DELETE /matches/:id/leave`, `DELETE /reservations/:id`).
 * `null` there when nothing had been paid.
 */
export interface PlayerRefundResult {
  /**
   * `refunded` = everything paid went back; `partial` = part of it; `none` = nothing is owed
   * (0% late refund or after the start); `pending` = money is owed but could not be returned yet.
   */
  status: PolicyRefundStatus
  reason: RefundReason
  /** Percent of what was paid that the policy returns (0..100). */
  percent: number
  /** Sum of the payments involved, currency units. */
  amount_paid: number
  amount_refunded: number
  /** Owed and not yet returned (the club has been notified). */
  amount_pending: number
  /** true when part of the refund is pending: the player must be told it is on its way. */
  refund_pending: boolean
  /** The policy applied (already clamped to the platform limits). */
  policy: RefundPolicy
}

export function toPlayerRefundResult(summary: PolicyRefundSummary): PlayerRefundResult | null {
  if (summary.outcomes.length === 0) return null
  const cents = (n: number) => Math.round(n * 100)
  const paid = summary.outcomes.reduce((sum, o) => sum + cents(o.paid), 0)
  const hasPending = summary.pending.length > 0
  let status: PolicyRefundStatus
  if (hasPending) status = 'pending'
  else if (summary.outcomes.every((o) => o.status === 'none')) status = 'none'
  else if (summary.outcomes.every((o) => o.status === 'refunded')) status = 'refunded'
  else status = 'partial'
  return {
    status,
    reason: summary.reason,
    percent: summary.percent,
    amount_paid: paid / 100,
    amount_refunded: summary.amount_refunded,
    amount_pending: summary.amount_pending,
    refund_pending: hasPending,
    policy: summary.policy,
  }
}
