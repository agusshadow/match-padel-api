# Mercado Pago account of each club — match-padel-api

Introduced by card #74 (`[Admin F3]`, API half). Code: `src/domains/club-mercadopago/` (logic in
`club-mercadopago.core.ts`, wiring in `club-mercadopago.service.ts`), `src/lib/mp-oauth.ts` (authorization URL, token
client), `src/lib/secret-box.ts` (AES-256-GCM) and `src/jobs/refresh-mp-tokens.job.ts`. Scope reference:
`match-padel-web/docs/club-platform-scope.md`, section 6.

> **Status: written from the public Mercado Pago documentation, NOT verified against the Mercado Pago sandbox.** Nothing
> in this card was run against Mercado Pago (no credentials were available). Card #73 (the sandbox spike) verifies it.
> The points most likely to need adjustment are listed under "Unverified assumptions".

The existing charging flows (`payments` domain) still use the global `MP_ACCESS_TOKEN`; card #75 switches them to the
club's token through `getClubAccessToken`.

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
