# Refund policy per club — match-padel-api

Introduced by card #76 (`[Admin F3]`, API half). Code: `src/domains/payments/refund-policy.core.ts` (pure engine and
orchestration), `refund-policy.service.ts` (read/write of policies and limits), `payment.service.ts`
(`refundPaymentsByPolicy`, wiring to Mercado Pago). Scope reference: `match-padel-web/docs/club-platform-scope.md`,
sections 4, 6 and 7.

> **Status: partial refunds are written from the Mercado Pago documentation and NOT verified against the sandbox**
> (card #73 spike). See `docs/mercadopago.md`, "Refunds" and its unverified list.

## The rule

Each club defines its own policy inside limits set by the platform:

| Field | Meaning | Range | Default (every existing club) |
|---|---|---|---|
| `hours_before_start` | cutoff: cancelling AT LEAST this long before the start refunds 100% | 0..720 | 24 |
| `late_refund_percent` | share of what the player paid refunded **in money** when cancelling inside the cutoff window | 0..100, 2 decimals | 0 |

`computeRefund({ amountPaid, startsAt, cancelledAt, policy })` returns `{ percent, amount, reason }`:

| Moment | `reason` | `percent` |
|---|---|---|
| `startsAt - cancelledAt >= hours_before_start` (the cutoff itself is inclusive) | `before_cutoff` | 100 |
| after the cutoff, before the start | `late_window` | `late_refund_percent` |
| at or after the start | `after_start` | 0 |

Amounts are computed in integer cents and rounded half up; never above what was paid. A 100% late refund is a full
refund (the payment becomes `refunded`); a smaller one is a partial refund (the payment stays `approved`).

## Platform limits

`platform_settings.refund_policy_minimums` = `{ max_hours_before_start, min_late_refund_percent }`, default
`{ 48, 0 }`. They protect players: a club's `hours_before_start` must be `<= max_hours_before_start` and its
`late_refund_percent` `>= min_late_refund_percent`.

- Saving a policy outside the limits: 409 `POLICY_BELOW_PLATFORM_MINIMUM` (`details.limits`, `details.violations`).
- Changing the limits (superadmin) **never rewrites** a club's stored policy. A stored policy outside the new limits is
  **clamped at evaluation time** (`clampPolicy`) and the club's `GET /refund-policy` answers `clamped: true` with the
  stored values and the `effective` ones. `GET /platform/settings/refund-policy` reports `clubs_clamped`.
- Players always see the effective policy (club detail `refund_policy`, availability and slots `meta.refund_policy`).

## Who is refunded by whom

| Cancellation | Who decides the amount |
|---|---|
| Player leaves a match (`DELETE /matches/:id/leave`) | the club's policy, for the leaver's payment |
| Creator cancels the match (`DELETE /matches/:id`) | the club's policy, for every approved payment of the match |
| Booker cancels a reservation (`DELETE /reservations/:id`) | the club's policy, for every approved payment of the reservation. **Behaviour change**: this endpoint never refunded before. A reservation that hosts a match cancels the match too |
| Club cancels (`POST /club-admin/:clubId/reservations/:id/cancel`, status PATCH) | always 100%, unchanged (card #71) |
| Match never fills (job `auto-cancel-unfilled-matches`) | 100%, unchanged |

The policy that applies is the one in force **at the moment of cancelling** (the club resolved from the reservation).
A payment the policy already settled (`refund_status` `none`/`partial`/`full`) is not refunded again by a later
cancellation: a player who forfeited the rest does not get it back when the club cancels afterwards.

## What changed (one behaviour change for the default policy)

Before this card a late cancellation (under 24h) returned no money but credited half of the share as internal currency
(card #63). That credit is **removed** (`creditLateCancellationCurrency` is gone; `credit_currency` stays for challenge
rewards and past `points_transactions` rows with reason `late_cancellation_credit` are untouched). With the default
policy (24h, 0%) a late cancellation now refunds 0 and credits nothing. A club that wants to return something sets
`late_refund_percent`.

`DELETE /matches/:id/leave` keeps `currencyCredited` in its response (always `0`) for existing clients.

## Pending refunds

Money is never promised that cannot be paid. When a refund owed by the policy cannot be completed (club link expired
or revoked, no balance in the club's account, Mercado Pago rejects it, network error):

1. the cancellation goes through (player leaves, match/reservation cancelled);
2. the payment is left `approved` with `refund_status = 'pending'` and `refund_error` (internal code);
3. the club's owners get an in-app notification (`type: system`, `data.kind = 'refund_pending'`) and the
   `refund_pending` email;
4. the other players of a cancelled match whose refund is pending get a `refund_pending` in-app notification;
5. the response of the cancelling player has `refund.status = 'pending'`, `refund.refund_pending = true`.

`refund_status` values: `none` (nothing owed or 0%), `partial`, `full`, `pending`, and `failed` (reserved, not written
by the API today). There is no retry job and no endpoint to settle a pending refund yet (target — not implemented yet);
a later club cancellation of that reservation retries it at 100%.

## Response shapes

`refund` field (`PlayerRefundResult`, null when nothing was paid) of `DELETE /matches/:id`, `DELETE /matches/:id/leave`
and `DELETE /reservations/:id`:

```json
{
  "status": "refunded | partial | none | pending",
  "reason": "before_cutoff | late_window | after_start",
  "percent": 50,
  "amount_paid": 1000,
  "amount_refunded": 500,
  "amount_pending": 0,
  "refund_pending": false,
  "policy": { "hours_before_start": 24, "late_refund_percent": 50 }
}
```

Endpoints and permissions: `docs/endpoints.md`, `docs/permissions.md`.

## Not covered

- Tournament registration fees have no payment flow yet.
- A refund of a payment collected by the platform account (`collected_via = 'platform'`, every club created before card
  #75) is made from the platform's account, as before; the "from the club's account" wording applies to
  `club_account` clubs.
- Two concurrent cancellations of the same payment are not serialized (see the idempotency note in
  `docs/mercadopago.md`).
