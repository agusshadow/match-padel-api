# CLAUDE.md — match-padel-api

This file is your working contract. Read it completely before touching any file.

## What this project is
REST API for Match Padel. Node.js + Express 4 + TypeScript. It serves both the player PWA and the B2B admin panel.

## Stack
- **Runtime**: Node.js 22 + TypeScript
- **Framework**: Express 4
- **Database**: Supabase (PostgreSQL) — `@supabase/supabase-js` client with the `service_role` key (bypasses RLS)
- **Auth**: Supabase JWT — verified in the `requireAuth` middleware
- **Payments**: MercadoPago SDK
- **Push**: Firebase Admin SDK (target; not installed yet)
- **Validation**: Zod (in every controller, always)
- **Tests**: Vitest + Supertest (target; not configured yet, see "Real state vs. target")
- **Logs**: structured JSON to stdout (no `console.log`, always the logger)

## Folder structure

```
src/
├── domains/          ← one directory per business domain
│   ├── auth/
│   ├── clubs/
│   ├── reservations/
│   ├── matches/
│   ├── tournaments/  ← tournaments managed by clubs (card #77): player routes under /tournaments, club panel under /club-admin/:clubId/tournaments; pure fixture (`fixtures.core.ts`) and bracket/standings (`bracket.core.ts`) logic, orchestration with injected collaborators (`tournament.core.ts`)
│   ├── users/
│   ├── access/       ← /me/access, platform role + club memberships (card #66)
│   ├── club-admin/   ← club panel API, /club-admin/:clubId (onboarding, courts, documents: card #67; schedules, exceptions, price rules: card #70; calendar, move/cancel, blocks: card #71)
│   ├── courts/       ← public slots route, effective schedule/price resolution (schedule.service.ts, pure) and its loader (card #70)
│   ├── team/         ← club team: invitations, members, accept (card #72), under /club-admin/:clubId/team, /invitations and /me/invitations/accept
│   ├── club-mercadopago/ ← Mercado Pago account of each club: OAuth link, encrypted tokens, renewal, `getClubAccessToken` (card #74), under /club-admin/:clubId/mercadopago and /mercadopago/oauth/callback
│   ├── audit/        ← recordAudit / audit_log
│   ├── catalogs/     ← gamification catalogs admin (achievements, challenges, cosmetics, images), under /platform/catalogs, superadmin only (card #78)
│   ├── mail/         ← transactional email (Resend), templates, email_log, notifyApplicationStatusChange (card #69)
│   └── platform/
├── middleware/       ← reusable global middleware
├── lib/              ← external clients (supabase, mercadopago, firebase, logger)
├── types/            ← shared global types (not domain types)
└── index.ts          ← Express setup, global middleware, router registration (entry point)
```

Every domain has exactly this internal structure:
```
domains/<name>/
├── <name>.router.ts      ← defines routes and chains middleware
├── <name>.controller.ts  ← receives req, validates with Zod, calls the service, returns res
├── <name>.service.ts     ← pure business logic (no Express)
├── <name>.repository.ts  ← all Supabase queries (the only place with DB calls)
├── <name>.validator.ts   ← exported Zod schemas, reused in the controller
└── __tests__/            ← integration tests with Supertest
```

## Architecture rules — NEVER break them

1. **The flow is always**: Router → Controller → Service → Repository. No shortcuts.
2. **The Controller has no business logic**. Only: parse req, validate with Zod, call the service, return res.
3. **The Service does not know Express exists**. It never imports `Request`, `Response` or `NextFunction`.
4. **The Repository is the only place with Supabase queries**. No other file uses `supabase.from(...)`.
5. **If an operation touches two domains**, one domain's service imports the other's *repository*. Never the other's *service*.
6. **Zod validation always in the controller**, before calling the service. If the body fails the schema, respond 400 before reaching the service.
7. **Never hand-write types** for DB entities. Use the generated types in `src/types/supabase.ts`.

## Response envelope — mandatory format

**Success:**
```json
{ "success": true, "data": <payload> }
```

**Error:**
```json
{ "success": false, "error": { "code": "SNAKE_CASE_CODE", "message": "readable", "details": {} } }
```

Standard error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`.

**Pagination** (when applicable):
```json
{
  "success": true,
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

## Auth middleware

```typescript
requireAuth                          // verifies the Supabase JWT, sets req.userId (src/middleware/auth.ts)
loadAccess                           // loads platform role + club memberships once per request into req.access (src/middleware/access.middleware.ts)
requireRole(['superadmin'])          // platform routes (/platform/*); a superadmin passes any list
requireClubRole(['owner', 'admin'])  // club routes, reads req.params.clubId; a platform superadmin always passes
```

Always in that order in a route's middleware chain (`requireRole`/`requireClubRole` call `loadAccess` themselves when it has not run). Club roles: `owner` = Dueño, `admin` = Administrador, `staff` = Recepción. Permission matrix in `docs/permissions.md`.

## Environment variables

See `.env.example`. Never hardcode values. Always access them via `process.env.NAME`.
Required today: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PORT`. Also `CORS_ORIGIN`, `APP_URL`, `API_URL` and `MP_ACCESS_TOKEN` depending on the environment. (`JWT_SECRET` used to be listed but the code does not use it.)

Transactional email (card #69, `docs/email.md`; also the team invitation link, card #72) adds optional `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_MODE`, `APP_ENV`, `MAIL_DEV_RECIPIENT` and `CLUB_PANEL_URL`; without a key the mail module only logs.

The club's Mercado Pago link (card #74, `docs/mercadopago.md`) adds optional `MP_APP_ID`, `MP_APP_SECRET`, `MP_OAUTH_REDIRECT_URI`, `MP_TOKEN_ENCRYPTION_KEY` (32 bytes base64) and `MP_OAUTH_PKCE`; without the first four its endpoints answer 503 `MP_NOT_CONFIGURED`. Never log a token or the client secret.

`SUPABASE_ANON_KEY` backs an isolated client (`supabaseAuth` in `src/lib/supabase.ts`) used only to mint sessions in `auth.controller.ts` (`signInWithPassword`). Never call session-mutating auth methods on the `service_role` client (`supabase`): supabase-js swaps its Authorization header to the authenticated user's token as soon as a session is established, silently downgrading every later `.from(...)` call in the process from `service_role` to that user.

## Rate limiting

- 100 req/min per IP (global)
- 1000 req/min per authenticated user
- 5 req/min on sensitive endpoints: `/auth/register`, `/auth/login`, MercadoPago webhooks

## How to add a new endpoint

Read `docs/implementing.md`. Always.

## Tests

- Test file at `src/domains/<name>/__tests__/<name>.test.ts`
- Use Supertest for integration tests (not isolated controller unit tests)
- Mock Supabase with `vi.mock` in the repository
- Minimum coverage 70% in `src/domains/`
- Run with: `npm test` (once the framework is configured)

## What you must NOT do

- ❌ `console.log` — use the logger in `src/lib/logger.ts`
- ❌ Supabase queries outside a repository
- ❌ Business logic in the controller
- ❌ Hand-written DB types — only from `src/types/supabase.ts`
- ❌ Use `any` in TypeScript
- ❌ Endpoints without Zod validation
- ❌ Responses without the `{ success, data/error }` envelope
- ❌ EventEmitter for simple async operations — use `async/await` directly

## Real state vs. target

This document describes the **target architecture**. The existing code does not always meet it. For new code follow the target; do not copy the deviations in the right-hand column, and do not "fix them along the way" unless the plan asks for it (they are cleaned up in separate tasks).

| Topic | Target (this document) | Reality today |
|---|---|---|
| Controllers | No logic, no queries | `auth.controller.ts` makes Supabase queries and holds business logic |
| File names | `.router.ts`, `.validator.ts` | Mostly correct; there are unused duplicate plural routers (`clubs.router.ts`, `matches.router.ts`, `reservations.router.ts`, `tournaments.router.ts`, `users.router.ts`) |
| Middleware | One file per responsibility | Duplicates: `auth.ts` and `auth.middleware.ts`, `error.ts` and `error.middleware.ts` (10 files import each version of auth). **Canonical: `auth.middleware.ts` and `error.middleware.ts`** (the real rate limit is inline in `index.ts`; `rate-limiter.middleware.ts` is only used by the dead `app.ts`) |
| Entry point | `index.ts` | A duplicate `app.ts` also exists and is unused |
| Rate limiting | 100/min per IP, 1000/min per user, 5/min on sensitive endpoints | Met for IP (`trust proxy` set) and for `/auth/login`+`/auth/register` (5/min via `authLimiter`). Per-authenticated-user limit (1000/min) and the MercadoPago webhook limit are still not implemented |
| Error responses (details) | `details` in the error envelope | `AppError` has an optional `details` (card #67), returned by `error.middleware.ts` next to `error` and `message` (used by 422 `APPLICATION_INCOMPLETE`); the rest of the shape is still `{ error, message }` |
| Role-based auth | `requireRole`, `requireClubRole` | Met (card #66): `requireRole` (platform roles from `platform_staff`) and `requireClubRole` (per-club role from `club_staff`) in `src/middleware/access.middleware.ts`. Only the new `/me`, `/club-admin` and `/platform` routes use them; the older player routes still check ownership/staff inside their services. `users.role` is kept for the player app but the API no longer uses it for authorization of the new routes |
| DB types | Generated in `src/types/supabase.ts` | The file does not exist |
| Tests | Vitest + Supertest, 70% in `src/domains/` | No framework and no tests |
| Logs | Logger, no `console.log` | `src/lib/logger.ts` is a thin `console` wrapper that nothing imports; `index.ts` and the error handlers call `console.log`/`console.error` directly |
| Push | Firebase Admin | Not installed |
| Async error handling | Every error reaches the error handler | All controllers (including tournaments, fixed) wrap handlers in try/catch → `next(err)`, and `index.ts` has `process.on('unhandledRejection'/'uncaughtException')` as a last-resort net. The MercadoPago webhook replies 200 and then processes async — since headers are already sent it can't call `next(err)`, so it logs the error directly with `logger.error` instead |
| Error responses | The `{ success: false, error: { code, message, details } }` envelope | The mounted `error.middleware.ts`, `notFound` and `auth.middleware.ts` answer `{ error, message }`. `error.ts` has the envelope but is not mounted |
| Auth data on the request | `req.user` with id, email and role | `requireAuth` sets only `req.userId`. Card #66 adds `req.access` (platform role + memberships), `req.platformRole` and `req.clubRole`, set by the role middleware; `req.user` is still never populated |
| Auth domain files | Controller → service → repository | `auth.service.ts` is never imported (its repository and validator only by each other); `auth.controller.ts` does everything itself |
| Input validation | Zod in every controller | `users` controller validates only the new `getLeaderboard` query (card #60) — `updateMe` and the rest still read `req.body` without a schema; `matches` validates `createMatch`/`submitScore` (card #57/#58) but the rest of its handlers don't yet; `auth`, `reservations`, `chats` and `tournaments` validate |
| Webhook safety | Signature check + idempotency via `mp_webhook_events` | Met via `payment.service.ts` (`verifyWebhookSignature`, amount check, idempotency via the existing `payments.mp_event_id` column instead of a separate table — no `mp_webhook_events` table exists) |
| Charging (card #75) | Seller per club, commission as `marketplace_fee`, webhooks per seller | Met in code, written from the MP documentation and **not verified against the sandbox** (card #73); `payment.service.ts` still holds older inline queries (new ones are in `payment.repository.ts`) and other domains still import `payment.service.ts` (`payments_enabled`, refunds) |
| Refund policy (card #76) | Club policy within platform limits, partial refund in money from the club account | Met in code; partial refunds written from the MP documentation and **not verified against the sandbox** (card #73). No automatic retry or endpoint to settle a `pending` refund yet |
| Domain boundaries (rule 5) | A domain's service imports only the other domain's repository, never its service | `payments` has no `payment.repository.ts` (documented above), so `match.service.ts` (card #57) imports functions straight from `payment.service.ts` for match payment preferences/refunds — the alternative (duplicating MercadoPago preference/refund logic inside the matches domain) was judged worse. `payment.service.ts` itself imports `matchRepository` (a real repository) to insert confirmed players and check the 4-player count on webhook approval, which does follow the rule |
| Tournaments (card #77) | Created and managed by the club, four formats, results, standings, fee paid in the app | Met in code. Fixtures/standings property-checked and flows checked against a fake database; the registration payment is written from the MP documentation and **not verified against the sandbox** (card #73). No third-place match and no bracket reset in double elimination (documented). `payment.service.ts` imports `tournament.core.ts` and `tournament.repository.ts` for the webhook confirmation and `tournament.service.ts` imports `payment.service.ts` (no cycle). `docs/tournaments.md` |
| ELO | Worker computing ELO | Fixed ±15 delta (not a true ELO formula weighted by rating difference), applied atomically inside `submit_match_score_draft`/`accept_match_score` (card #58/#21) when both teams' independently-submitted score drafts agree on a ranked match; no scheduled worker |
| Level/XP | Separate from ELO — engagement, not skill | Met (card #61/#62): `users.xp`/`users.level`, awarded by `award_match_xp` (20 XP playing / 30 XP winning) and by completing a challenge's `reward_xp`, both inside `accept_match_score`; level derived from cumulative XP via `level_for_xp` |
| Gamification catalogs | Administered from the platform panel | Met (card #78): `/platform/catalogs`, superadmin only; achievements are awarded from `achievements.condition` (`matches_played`/`wins` only). `docs/catalogs.md` |
| Challenges | Rotating catalog with automatic assignment | Met (card #62), deliberately minimal — only `play_matches`/`win_matches` action types (no `reach_level`/`complete_profile`); `reward_currency` now pays out too (card #63) |
| Marketplace / internal currency | Cosmetics bought with an earned-or-bought currency | Met (card #63): `users.points_balance` (ledgered in `points_transactions`), one fixed MercadoPago top-up pack (`CURRENCY_PACK` in `payment.service.ts`, no multiple tiers yet), atomic `purchase_cosmetic`. Since card #76 a late match cancellation no longer credits currency (it used to, card #57/#63): the club's refund policy returns part of the amount in money (`docs/refund-policy.md`); `credit_currency` remains for challenge rewards |

## Agent workflow

Requirements come in through a Claude session. The main session **orchestrates**; the subagents in `.claude/agents/` execute. The `/implement <requirement>` command (`.claude/skills/implement/`) triggers the full flow:

1. `planner` → plan + API contract
2. **Checkpoint: the user approves the plan** (nothing is coded before that)
3. `db-agent` (only if there are schema changes; it applies them to the **dev** Supabase project, never to production, see below)
4. `backend-dev` → implementation
5. `tester` → tests
6. `reviewer` → review (max. 2 rounds of fixes)
7. `pr-agent` → branch, commits and PR against `develop`

| Agent | Responsibility |
|---|---|
| `planner` | Plan and API contract. Read-only |
| `backend-dev` | Code in `src/` (domains, middleware, payments, sockets, jobs) |
| `db-agent` | Migration files, RLS, `docs/schema.sql`. File first, applied to the dev Supabase project only and without asking |
| `release-agent` | At release time, applies the pending migrations to production before the release PR is merged; every call is checked by the production database guard hook |
| `tester` | Tests. Does not modify production code |
| `reviewer` | Diff review. Does not modify code |
| `pr-agent` | Git and `gh`: branches, commits, PR |

Supporting skills: `new-domain`, `db-migration`, `pr-format`, `release`, `trello-story`.

## Branches, environments and hard rules

- `main` is **production** (Render `match-padel-api`, Supabase `match-padel`, project `ebdnlrwzhthqflsbdzvu`). `develop` is the working branch and deploys to the **dev environment** (Render `match-padel-api-dev` at https://match-padel-api-dev.onrender.com, Supabase `match-padel-dev`, project `vrnonxpxksaruvsvbplt`). Local work also points at dev, never at production. The dev environment was decommissioned on 24/09/2026 and rebuilt on 03/10/2026; its schema is built from `supabase/migrations/` and was verified identical to production when it was recreated. The dev Render service needs its own env vars (`SUPABASE_SERVICE_ROLE_KEY` etc.), set by the human in the Render dashboard; the web previews on `develop` get theirs from Vercel's Preview variables scoped to that branch.
- **`main` and `develop` accept no direct commits or pushes.** Everything goes through a pull request. GitHub branch protection is not available for private repos on the free plan, so it is enforced locally: (1) a Claude Code hook (`.claude/hooks/guard-protected-branches.py`, registered in `.claude/settings.json`) that blocks agents, in every session on this repo; (2) git hooks in `.githooks/` for the human, enabled once per clone with `git config core.hooksPath .githooks`. Only the human may override the git hooks in an emergency (`ALLOW_PROTECTED_BRANCH=1`); agents must never bypass them.
- **Day-to-day:** feature branch from `develop` → PR against `develop` → merged with **squash** by the human.
- **Release** (`/release` skill): when `develop` has accumulated several commits, a `release/vX.Y.Z` branch is cut from `develop` with all of them plus **one** extra commit, `chore: version bump`, that only raises the version. It is merged into `main` with a **merge commit** (to keep traceability), then `main` is merged back into `develop` (PR, **merge commit**) so both branches are level again.
- Never enable "automatically delete head branches" on the repository: the release flow uses `develop` and `main` as PR heads.
- Commits and PRs in **English**, conventional commits. See the `pr-format` skill.
- **Schema changes are file first.** Every change is a migration file under `supabase/migrations/` (created with `supabase migration new`) before it touches any database. `db-agent` applies it to the **dev** project without asking, aligns the version recorded in dev with the file's version and verifies the contents (see the `db-migration` skill). The same files are promoted to production at release time, in order and **before** the release PR is merged, because Render redeploys the API as soon as `main` changes; so migrations must be additive and backward compatible, and destructive ones need the human's explicit go-ahead and their own release. Applied migrations are immutable: a mistake is fixed with a new migration. The `Migrations` GitHub workflow replays every migration on an empty database on each PR and blocks edits to existing files. `docs/schema.sql` is a derived, human-readable view; the migrations win if they disagree. Migrations reach production through the `release-agent` (invoked by the `release` skill before the release PR is merged), and every production database call is checked by `.claude/hooks/guard-production-db.py`: only exact migration files, and destructive or security-weakening SQL pauses for the human's confirmation. Other production actions (Render/Vercel config, env vars) still require the human to do them or explicitly direct a session to.
- RLS (card #65): the open policies (anon-key inserts on `notifications` and `tournament_matches`, direct client writes on `matches`, `match_players`, `court_reservations`, `tournaments` and `tournament_teams`, and public reads of `matches`, `match_players` and draft tournaments) are closed by migration `20261010135812_tighten_open_rls_policies`. It is applied to **dev** and reaches production with the next release, through the `release-agent`; until then production still has the old policies. Reads that the admin panel makes directly stay available to staff. Card #66 (migration `20261010145531_admin_foundations`, dev only until the next release) narrows "staff" to membership of the row's club through `club_staff` (or a platform superadmin) instead of `users.role in ('club_staff','super_admin')`, via the `is_club_member`/`is_court_club_member`/`is_match_club_member` helpers. Known leftovers: the admin panel still writes `clubs` and `court_reservations` straight to Supabase, which RLS already blocked; those screens need to go through `/club-admin` and `/platform`.
- Card #67 (migration `20261010150929_admin_club_onboarding`, dev only until the next release): `clubs.status` (`club_status`) with every existing club backfilled to `approved`, `legal_name`, `tax_id`, `club_status_history`, `club_documents` and the private `club-documents` bucket. The API filters every public club read by `status = 'approved'` and `is_active`, and the RLS public read policies of `clubs`/`courts` do the same. Lifecycle: `docs/club-lifecycle.md`.
- Card #69 (migration `20261010152129_email_log`, dev only until the next release): `email_log` (RLS on, no policies) records every transactional email attempt. Module and configuration: `docs/email.md`.
- Card #68: no migration. Application review (`/platform/applications`, approve / request changes / reject, superadmin `reopen`, `suspend`, `unsuspend`) over the card #67 tables, with `suspended`/`reinstated` emails. A reviewer only sees `pending` and `changes_requested` clubs. See `docs/club-lifecycle.md`.
- Card #70 (migration `20261010153252_court_schedules_exceptions_price_rules`, dev only until the next release): weekly schedules per court (existing `court_schedules`, several intervals per day, `24:00` close), `court_schedule_exceptions` and `court_price_rules`, backfilled from `clubs.settings.opening_hours`. Slots, prices and reservation/match totals come from `src/domains/courts/schedule.service.ts` (pure); see `docs/availability-and-pricing.md`.
- Card #71 (migration `20261010154511_court_blocks`, dev only until the next release): `court_blocks`, the `create_court_blocks` RPC and a trigger on `court_reservations` that refuses a booking or move over a block. `GET /club-admin/:clubId/calendar`, `PATCH .../reservations/:id/move`, `POST .../reservations/:id/cancel` (club cancellation: always 100% refund, match cancelled with it, in-app notification) and `/blocks`; slots carry `unavailable_reason` and booking returns 409 `COURT_BLOCKED`. See `docs/availability-and-pricing.md`.
- Card #72 (migration `20261010155448_club_team_invitations`, dev only until the next release): `club_invitations` (RLS on, no policies; only the token's SHA-256 is stored) and the `accept_club_invitation` RPC. Club team: `GET /club-admin/:clubId/team` (owner/admin), owner-only writes (invite, resend, revoke, change role, remove), `POST /me/invitations/accept` and public `GET /invitations/preview`; `team_invitation` email. Reception can no longer confirm/complete reservations. The owner role is not invitable. See `docs/club-lifecycle.md` (Team) and `docs/permissions.md`.
- Card #78 (migration `20261010160513_gamification_catalogs`, dev only until the next release): `is_active`/`created_at`/`updated_at` on `achievements`, `updated_at` on `challenges` and `cosmetics`, `accept_match_score` awards from `achievements.condition` (only active ones), `purchase_cosmetic` raises `COSMETIC_INACTIVE`, owner/participant read policies and the public `catalog-assets` bucket. `/platform/catalogs` (superadmin only) edits the three catalogs; deactivating never touches what players own. See `docs/catalogs.md`.
- Card #74 (migration `20261010161419_club_mercadopago_accounts`, dev only until the next release): `club_mp_accounts` (the club's Mercado Pago seller tokens, AES-256-GCM encrypted with `MP_TOKEN_ENCRYPTION_KEY`, RLS on, no policies, no client grants) and `mp_oauth_states` (single-use anti-CSRF state). `POST/GET/DELETE /club-admin/:clubId/mercadopago` (owner only), public `GET /mercadopago/oauth/callback`, daily renewal job `refresh-mp-tokens`, `getClubAccessToken(clubId)` for card #75, `mp_connection_expiring`/`mp_connection_failed` emails. Written from the Mercado Pago documentation and **not verified against the MP sandbox** (card #73). See `docs/mercadopago.md`.
- Card #75 (migration `20261010162613_club_charges_commission`, dev only until the next release): `clubs.commission_percent` (default 0, set by the superadmin) and `clubs.collection_mode` (`platform_account` for every existing club, `club_account` for new ones); `payments` gains `club_id`, `seller_mp_user_id`, `commission_percent`, `marketplace_fee`, `net_amount`, `collected_via`; `payment_totals` RPC. Charges of a `club_account` club are made with the club's token and carry `marketplace_fee`; the webhook (`?club_id=`) fetches with the seller's token and validates it against the row; refunds use the collecting account's token (optional partial `amount`, for card #76). Without a usable link: `meta.payments_enabled = false` and 409 `CLUB_PAYMENTS_NOT_ENABLED`. `PATCH /platform/clubs/:clubId/commission`, `/collection-mode`, `GET /platform/payments`, `GET /club-admin/:clubId/payments`. Written from the Mercado Pago documentation, **not verified against the sandbox** (card #73). See `docs/mercadopago.md` (Charging).
- Card #76 (migration `20261010163835_club_refund_policy`, dev only until the next release): `clubs.refund_hours_before_start` (default 24) and `clubs.refund_late_percent` (default 0), `payments.refund_status`/`refunded_amount`/`refund_error` and `platform_settings` (RLS on, no policies, no client grants; seeded with `refund_policy_minimums` = `{ max_hours_before_start: 48, min_late_refund_percent: 0 }`). A player's cancellation (match leave, match cancelled by its creator, reservation cancelled by its booker) refunds per the club's policy: 100% at least `hours_before_start` before the start, `late_refund_percent` in money inside the window, 0 after the start (`computeRefund`, `src/domains/payments/refund-policy.core.ts`); club-initiated cancellations stay 100%. The late-cancellation currency credit and `creditLateCancellationCurrency` are removed; `DELETE /reservations/:id` now refunds. A refund that cannot be completed leaves the payment `pending` and notifies the club owners. `GET`/`PUT /club-admin/:clubId/refund-policy`, `GET`/`PUT /platform/settings/refund-policy`, `refund_policy` in the club detail and availability responses. Partial refunds written from the MP documentation, **not verified against the sandbox** (card #73). See `docs/refund-policy.md`.
- Card #77 (migration `20261010165330_club_tournaments_management`, dev only until the next release): tournaments are created and managed by the club (`/club-admin/:clubId/tournaments`: create, edit, publish, cancel, start, result, standings; owner/admin only). `tournaments` gains `category`, `min_elo`/`max_elo`, `registration_deadline`, `started_at`/`completed_at`/`cancelled_at`/`cancel_reason`; `tournament_teams` gains `status` (`pending_payment`|`confirmed`), `expires_at`, `paid_at`, `payment_id`; `tournament_matches` gains `stage`, `position`, the bracket links, americano players and result author; `payments` gains `tournament_id`/`tournament_team_id`. Registration fee charged through `resolveSeller` with the club commission (pending 30 minutes, webhook confirms, expiry job `expire-tournament-registrations`, refund per the club policy on withdraw and 100% on cancel); the player-side `POST /tournaments` and `/start` are closed (403 `TOURNAMENTS_MANAGED_BY_CLUBS` / 410). Read policies of the three tournament tables tightened (unpaid teams and drafts no longer public). Payment flow **not verified against the sandbox** (card #73). See `docs/tournaments.md`.
- If an API change affects `match-padel-web`, the API PR is merged first and the web PR references it under "Related PR".

## Documentation map

- `docs/endpoints.md` — every endpoint that is actually mounted today (method, path, auth, controller), unmounted stubs and known gaps. **Read it before planning.**
- `docs/mercadopago.md` — the club's Mercado Pago link: flow, env vars, storage, renewal, token provider, what the human must configure (card #74); charging with commission, webhooks per seller, refunds and enforcement (card #75).
- `docs/refund-policy.md` — refund policy per club within platform limits: rule, engine, endpoints, pending refunds, what changed (card #76).
- `docs/tournaments.md` — tournaments managed by the club: lifecycle, fixture algorithms for the four formats, results and corrections, standings tie-breakers, registration payment and refunds (card #77).
- `docs/architecture.md`, `docs/conventions.md`, `docs/implementing.md`, `docs/api-patterns.md` — target architecture and how-tos. Anything not built yet is marked "target — not implemented yet".
- `supabase/migrations/` — the versioned history of the database: the exact migrations recorded in production plus the ones added since. Source of truth. `docs/schema.sql` is a readable view derived from it.

## Keeping documentation current

Documentation is part of the definition of done. In the **same PR** as the code:

- Added, changed or removed an endpoint → update `docs/endpoints.md`.
- Fixed or introduced a deviation from the target architecture → update the "Real state vs. target" table above.
- Added an environment variable → update `.env.example` (and `README.md` if it is required).
- Changed the schema → add the migration file first and update `docs/schema.sql` in the same PR (see the `db-migration` skill); never edit a migration that was already applied.
- Described something that is not built yet → mark it "target — not implemented yet".

`backend-dev` makes the update, `reviewer` checks it, and the PR checklist has an item for it.
