# Mercado Pago account of each club — match-padel-api

Introduced by card #74 (`[Admin F3]`, API half). Code: `src/domains/club-mercadopago/` (logic in
`club-mercadopago.core.ts`, wiring in `club-mercadopago.service.ts`), `src/lib/mp-oauth.ts` (authorization URL, token
client), `src/lib/secret-box.ts` (AES-256-GCM) and `src/jobs/refresh-mp-tokens.job.ts`. Scope reference:
`match-padel-web/docs/club-platform-scope.md`, section 6.

> **Status: written from the public Mercado Pago documentation, NOT verified against the Mercado Pago sandbox.** Nothing
> in this card was run against Mercado Pago (no credentials were available). Card #73 (the sandbox spike) verifies it.
> The points most likely to need adjustment are listed under "Unverified assumptions".

Card #75 (charging, commission and webhooks per seller) builds on it: see "Charging" below.

## Flow

```
Panel (owner)                    API                               Mercado Pago
     |                            |                                     |
     | POST /club-admin/:id/      |                                     |
     |   mercadopago/connect ---->| club approved? owner? config?       |
     |                            | state = 32 random bytes             |
     |                            | store sha256(state) (10 min)        |
     |<-- { authorization_url } --|                                     |
     | redirect browser ----------------------------------------------->| auth.mercadopago.com/authorization
     |                            |                                     |   ?client_id &response_type=code
     |                            |                                     |   &platform_id=mp &state &redirect_uri
     |                            |                                     | seller logs in and authorizes
     |<---------------------------------------- 302 redirect_uri?code&state
     | GET /mercadopago/oauth/callback?code&state  (public, rate limited)|
     |--------------------------->| consume state (single use, unexpired)
     |                            | owner still? club still approved?   |
     |                            | POST /oauth/token (authorization_code)->
     |                            |<-- access_token, refresh_token, expires_in, user_id, public_key, ...
     |                            | encrypt both, upsert club_mp_accounts, audit
     |<-- 302 <CLUB_PANEL_URL>/<clubId>/mercadopago?status=connected|error&reason=...
```

Daily (03:30 Buenos Aires): for every account ending within 30 days, `POST /oauth/token` with
`grant_type=refresh_token`; both new tokens are stored in one UPDATE (the refresh token rotates). Failures set
`status = 'error'` (or `expired`/`revoked`), keep `last_error`, retry the next day and email the owner(s).

## Environment variables

| Variable | Required for | Meaning |
|---|---|---|
| `MP_APP_ID` | the feature | Application ID of the Mercado Pago Marketplace app (`client_id`) |
| `MP_APP_SECRET` | the feature | Client secret of that app. Server only, never logged |
| `MP_OAUTH_REDIRECT_URI` | the feature | Static URL registered in the app. Value: `https://<api-host>/api/v1/mercadopago/oauth/callback`. Sent as `redirect_uri` in both the authorization URL and the token exchange; it must match the registered one exactly |
| `MP_TOKEN_ENCRYPTION_KEY` | the feature | 32 random bytes, base64. AES-256-GCM key. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Use a different key per environment. Losing or changing it makes every stored token unreadable: the clubs must link again |
| `MP_OAUTH_PKCE` | optional | `true` adds a PKCE S256 challenge to the authorization URL and the verifier to the token exchange. Off by default; enable only if the MP app has PKCE enabled |
| `CLUB_PANEL_URL` | already exists | Where the callback redirects the owner (and the email link). Default `https://match-padel-admin.vercel.app` |

All are optional at boot. If `MP_APP_ID`, `MP_APP_SECRET`, `MP_OAUTH_REDIRECT_URI` or `MP_TOKEN_ENCRYPTION_KEY` is
missing (or the key is not exactly 32 bytes of base64), the three club endpoints and the callback answer
**503 `MP_NOT_CONFIGURED`**, `getClubAccessToken` throws the same, and the renewal job does nothing. The API still boots.

## Storage

- `club_mp_accounts` (one row per club): `access_token_enc`, `refresh_token_enc` are `v1:` + base64url(IV | GCM tag |
  ciphertext), a random IV per value. The additional authenticated data is `<clubId>:access` / `<clubId>:refresh`, so a
  value copied to another club or column fails to decrypt. The key is never in the database.
- `mp_oauth_states`: only the SHA-256 of the `state`; valid 10 minutes; `used_at` is set by a single compare-and-set
  UPDATE, so a code/state pair works once. Old rows are purged opportunistically on `connect`.
- Both tables: RLS enabled, no policies, `anon`/`authenticated` grants revoked. PostgREST can never return a token.
- `status` is stored as a hint (`connected`, `expiring`, `expired`, `revoked`, `error`); the API derives the effective one
  from `expires_at` on every read (`deriveStatus`).

## Renewal and notifications

- Candidates: `status in (connected, expiring, error)` and `expires_at <= now + 30 days`. `expired`/`revoked` are not
  retried (the owner must link again).
- Failure classification: HTTP 400/401 from the token endpoint = `invalid_grant` = `revoked` (or `expired` if the
  access token already lapsed); 429, 5xx, network = transient = `error` (or `expired` if already lapsed).
- If the new tokens cannot be written (the refresh token already rotated at MP), the write is retried 3 times and, if it
  still fails, logged as `CRITICAL` (the club must link again). The write is a compare-and-set on the refresh token we
  used, so a concurrent renewal by another instance is never overwritten with an older pair.
- Emails (`docs/email.md`): `mp_connection_failed` once when the link becomes unusable; `mp_connection_expiring` when a
  renewal fails while the token is still valid, at most once every 7 days (`last_notified_at`).
- Nothing in this module logs a token, the client secret or a response body.

## Token provider

`getClubAccessToken(clubId): Promise<string>` (`club-mercadopago.service.ts`):

1. No row: `AppError` 409 `MP_ACCOUNT_NOT_CONNECTED`.
2. `revoked`, or `expires_at` in the past: `AppError` 409 `MP_ACCOUNT_EXPIRED` (`details.reason`: `expired` | `revoked`).
3. Ends within 5 minutes: renews on demand, **single-flight per club** (concurrent callers share one MP call within a
   process). If that renewal fails but the token is still valid it returns the current token.
4. Otherwise returns the decrypted access token. Unreadable stored value: 500 `MP_TOKEN_UNREADABLE`.

## Charging with a commission per club (card #75)

Code: `src/domains/payments/charging.core.ts` (pure logic, collaborators injected), `payment.service.ts` (wiring,
preferences, webhook, refunds), `payment.repository.ts`, `payment-admin.service.ts` (commission / mode / listings),
`src/lib/mercadopago.ts` (`createMpChargeClient(token)`: preference, get payment, refund; HTTP injectable).

### Model

| Where | Column | Meaning |
|---|---|---|
| `clubs` | `collection_mode` | `platform_account`: charges go to the platform's token with no fee (what every existing club does; **all existing clubs were backfilled to it**). `club_account`: charges go to the club's own linked account and carry the commission. **Default for new clubs: `club_account`.** |
| `clubs` | `commission_percent` | 0..100, 2 decimals. **Default 0 on purpose**: the superadmin sets each club's rate (`PATCH /platform/clubs/:clubId/commission`); nobody pays a commission nobody chose. |
| `payments` | `club_id` | Club of the charge (backfilled from the reservation). |
| `payments` | `collected_via` | `platform` or `club`: which account collected it. Default `platform` (so rows written by the previous API, which only ever used the platform token, are correct). |
| `payments` | `seller_mp_user_id` | Seller's Mercado Pago user: the linked account at charge time, then the payment's `collector_id` from the webhook. |
| `payments` | `commission_percent`, `marketplace_fee`, `net_amount` | Rate and amounts frozen at charge time. `net_amount = amount - marketplace_fee`, **before Mercado Pago's own processing fee**. The webhook replaces the fee with the `application_fee` Mercado Pago reports when it reports one. |

### Seller resolution (`resolveSeller`)

Given the club of a charge:

1. `platform_account` (or amount 0, or no club): platform token (`MP_ACCESS_TOKEN`), no `marketplace_fee`, plain
   `notification_url`: exactly the pre-card behaviour. `collected_via = 'platform'`.
2. `club_account`: `getClubAccessToken(clubId)`. `MP_ACCOUNT_NOT_CONNECTED`, `MP_ACCOUNT_EXPIRED` and
   `MP_NOT_CONFIGURED` become **409 `CLUB_PAYMENTS_NOT_ENABLED`** for the player (friendly Spanish message,
   `details.reason` = the underlying code). The club panel keeps seeing the specific `MP_*` codes on its own
   `/club-admin/:clubId/mercadopago` endpoints. `MP_TOKEN_UNREADABLE` stays a 500 (a server fault).
   The preference is created with a client built from THAT token:
   `marketplace_fee = round(amount x commission_percent / 100, 2)` (half up, computed in integer cents; clamped to the
   amount; **omitted when it is 0**), `notification_url = ${API_URL}/api/v1/payments/webhook?club_id=<uuid>`,
   `external_reference = payments.id` as always.
3. **Internal-currency purchases always use the platform token**, no fee and no `club_id`.

The seller is resolved before the `payments` row is inserted, so a club that cannot charge leaves nothing behind.

### Webhook

Same endpoint, signature verification and idempotency (`payments.mp_event_id`) unchanged.

1. `club_id` query param: validated as a uuid by the controller (`malformed` otherwise). Absent means platform-collected.
2. The payment is fetched with the seller token: the club's (`getClubAccessToken`) or the platform's.
3. The row found by `external_reference` must agree: club notification needs `payments.club_id = club_id` and
   `collected_via = 'club'`; a notification with no `club_id` needs `collected_via = 'platform'`. If the payment's
   `collector_id` and the row's `seller_mp_user_id` are both known and differ, it is ignored too.
4. Any malformed, unknown, mismatched or unfetchable club: **200, a `warn` log (no token, no body) and no state
   change.** The query alone is never trusted.
5. Amount check unchanged. On the update it records `seller_mp_user_id` (`collector_id`) and, for club payments,
   `marketplace_fee` / `net_amount`.

### Refunds

`refundPayment(paymentId, amount?)` and `refundAllApprovedPayments` use the token of the account that collected the
payment: `collected_via = 'club'` -> `getClubAccessToken(club_id)`; `platform` or null -> the platform token. If the club
token cannot be obtained (expired link) the refund returns `false` (logged, payment left `approved`), which the
callers already treat as "needs a manual refund". Full refund: `POST /v1/payments/{id}/refunds` without body, payment
becomes `refunded` (and, since card #76, `refund_status = 'full'`, `refunded_amount = amount`). **Optional `amount`**:
same endpoint with `{ amount }`, payment stays `approved` and the refund is appended to `metadata.partial_refunds`; an
amount of 0 or above the payment is a 400, an amount equal to the payment is a full refund.

Card #76 uses the partial refund for a player's cancellation inside the club's late window
(`refundPaymentsByPolicy`, policy in `docs/refund-policy.md`): the refund is `round(paid x late_refund_percent / 100, 2)`
from the club's account (the account that collected the payment, `collected_via = 'club'`). If the refund cannot be
completed (club link expired or revoked, no balance, Mercado Pago rejects it, network error) the cancellation still
goes through, the payment gets `refund_status = 'pending'` plus `refund_error` (an internal code such as
`CLUB_ACCOUNT_UNAVAILABLE:MP_ACCOUNT_EXPIRED` or `MP_REFUND_REJECTED:<http status>`), the club's owners are notified
(in-app and the `refund_pending` email) and the player's response says the refund is pending. There is no automatic
retry and no endpoint to settle a pending refund yet (target — not implemented yet): a later club cancellation of the
same reservation retries it (100%), otherwise it is handled by hand in Mercado Pago.

### Enforcement

For a `club_account` club WITHOUT a connected, non-expired link (or with the OAuth variables missing):
- club availability and court slots answer `meta.payments_enabled = false`;
- `POST /reservations` and `POST /matches` with a total above 0 answer 409 `CLUB_PAYMENTS_NOT_ENABLED`;
- a preference for an older pending reservation answers the same.
Free (0) flows and `platform_account` clubs are unaffected. `payments_enabled` never decrypts a token (it reads the
link's status and `expires_at`).

Tournament registration fees (`tournaments.entry_fee`) are charged since card #77 on top of `resolveSeller`, with the same
seller, commission, webhook and refund rules: `docs/tournaments.md`, "Registration payment". A `payments` row of a
registration has `reservation_id = null` and `tournament_id` / `tournament_team_id` set; the webhook confirms the team or
refunds the payment in full when the place no longer exists. Unverified against the sandbox like the rest.

### Known exposure

`clubs` has table-level `select` for `anon`/`authenticated` and a public read policy for approved, active clubs, so
`commission_percent` and `collection_mode` are readable through PostgREST by anyone, like every other column of that
row (`docs/permissions.md`). The API never returns them to players. Hiding them needs a private table or column
privileges (a change to every direct `select *` of the clubs row), left for a follow-up.

### What the human must configure (card #75)

1. Nothing new in the environment. `API_URL` must be the public URL of the API (it builds `notification_url`) and
   `MP_WEBHOOK_SECRET` must be the secret of the Marketplace application's webhook configuration, which also
   receives notifications of the sellers' payments.
2. In the Mercado Pago application: webhooks (Payments topic) configured for the app, with the same URL
   (`/api/v1/payments/webhook`) and secret.
3. The superadmin sets each club's `commission_percent` and, when a club is ready, `collection_mode`
   (`PATCH /platform/clubs/:clubId/...`). Clubs created before the migration stay in `platform_account`.
4. The migration `20261010162613_club_charges_commission` reaches production with the next release, before the
   release PR is merged; it is additive and the API in production keeps working with it.

### Unverified assumptions of the charging flow (card #73 sandbox spike)

- `marketplace_fee` in the preference body is an amount in the transaction currency, accepted by Checkout Pro when the
  preference is created with the seller's token (and a 0 fee is omitted rather than sent).
- That the platform's own application (the Marketplace app) can create preferences with a seller's OAuth token and that
  the fee is credited to the application's owner account.
- `notification_url` with an existing query string: that Mercado Pago appends `data.id` / `type` with `&` and keeps
  `club_id`; and that `x-signature` verification of seller payments uses the same webhook secret
  (`MP_WEBHOOK_SECRET`), with `data.id` unchanged.
- The payment fields used: `collector_id` as the seller's user id, `fee_details[].type = 'application_fee'` as the
  marketplace fee, `transaction_amount` as the gross amount (not reduced by the fee).
- That a payment of a seller can only be read with that seller's token (and 404/401 with another), which is what makes the
  club check meaningful.
- Partial refund: `POST /v1/payments/{id}/refunds` with `{ amount }`; that refunds are made with the seller's token; that
  refund of a marketplace payment does or does not return the fee (open question of the scope document).
- Whether a `x-idempotency-key` is needed on refunds (the existing flow never sent one). Card #76 matters here: two
  concurrent cancellations of the same payment could both send a refund.
- Card #76: partial refunds in the late window have **never been run against Mercado Pago**. Unverified: that a refund
  with `{ amount }` below the payment is accepted for a payment made through a seller's token with a
  `marketplace_fee`; whether the platform's fee is returned proportionally on a partial refund; the exact error
  Mercado Pago answers when the seller has no available balance (only the HTTP status is recorded), and that it is not
  a retryable status; and that several partial refunds of one payment are accepted (the policy only ever makes one).
- A club-account preference's `back_urls` and `auto_return` behave as for the platform account.

## Unverified assumptions (check in the card #73 spike)

- Authorization URL host/params (`auth.mercadopago.com/authorization`, `platform_id=mp`), and whether Argentina needs
  the `.com.ar` host.
- Token response fields (`access_token`, `refresh_token`, `expires_in`, `user_id`, `public_key`, `scope`, `live_mode`).
  `expires_in` missing falls back to 180 days. `user_id` is required (without it the link is refused).
- The token exchange sends `test_token: false`; sandbox/test users may need `true`.
- That an expired or revoked refresh token answers 400/401 with `error = invalid_grant` (classification above).
- Whether PKCE must be enabled in the app, and then how (`MP_OAUTH_PKCE`).
- Whether the refresh endpoint also returns `user_id`, `public_key` and `live_mode` (kept from the first link if not).
- Whether a refresh is still accepted after the access token lapsed (the job tries once, then marks `expired`).
- The `error` query parameter of a denied authorization (`access_denied`).
- No revoke endpoint is called on disconnect.

## What the human must configure

1. **Mercado Pago Developers** (<https://www.mercadopago.com.ar/developers/panel/app>): create the application as a
   **Marketplace / Checkout Pro** app (model "marketplace"), under the platform's own account.
2. In the application: **Redirect URLs** = the value of `MP_OAUTH_REDIRECT_URI` (one per environment: the dev API and the
   production API each need their own app or their own registered URL). Enable the `offline_access` scope (without it
   there is no refresh token) together with the read/write scopes the app offers.
3. Copy the **Application ID** and **Client secret**.
4. Create **test users** (a test seller and a test buyer) for the sandbox spike (card #73).
5. **Render dev** (`match-padel-api-dev`) and **Render production** (`match-padel-api`): set `MP_APP_ID`,
   `MP_APP_SECRET`, `MP_OAUTH_REDIRECT_URI`, `MP_TOKEN_ENCRYPTION_KEY` (a different generated key per environment) and
   check `CLUB_PANEL_URL`. Optionally `MP_OAUTH_PKCE=true`.
6. Production credentials need to be activated on the MP side (industry, website, terms), and the club's account needs
   KYC (scope document, section 6).
7. The migration `20261010161419_club_mercadopago_accounts` reaches production with the next release, before the
   release PR is merged.
