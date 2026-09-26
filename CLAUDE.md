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
│   ├── tournaments/
│   ├── users/
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

## Auth middleware (target; today only `requireAuth` exists)

```typescript
requireAuth                          // verifies the Supabase JWT, adds req.user
requireRole(['super_admin'])         // only for /platform/* routes
requireClubStaff(clubId, ['owner', 'manager'])  // checks the club_staff table
```

Always in that order in a route's middleware chain.

## Environment variables

See `.env.example`. Never hardcode values. Always access them via `process.env.NAME`.
Required today: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`. Also `CORS_ORIGIN`, `APP_URL`, `API_URL` and `MP_ACCESS_TOKEN` depending on the environment. (`JWT_SECRET` used to be listed but the code does not use it.)

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
| Rate limiting | 100/min per IP, 1000/min per user, 5/min on sensitive endpoints | 200 requests per 15 min, global, and no `trust proxy` (behind Render everyone shares the same IP) |
| Role-based auth | `requireRole`, `requireClubStaff` | They do not exist; only `requireAuth` |
| DB types | Generated in `src/types/supabase.ts` | The file does not exist |
| Tests | Vitest + Supertest, 70% in `src/domains/` | No framework and no tests |
| Logs | Logger, no `console.log` | `src/lib/logger.ts` is a thin `console` wrapper that nothing imports; `index.ts` and the error handlers call `console.log`/`console.error` directly |
| Push | Firebase Admin | Not installed |
| Async error handling | Every error reaches the error handler | Unhandled promise rejections exist and crash the process. The MercadoPago webhook replies 200 and can then call `next(err)` (headers already sent) |
| Error responses | The `{ success: false, error: { code, message, details } }` envelope | The mounted `error.middleware.ts`, `notFound` and `auth.middleware.ts` answer `{ error, message }`. `error.ts` has the envelope but is not mounted |
| Auth data on the request | `req.user` with id, email and role | `requireAuth` sets only `req.userId`; no role is available |
| Auth domain files | Controller → service → repository | `auth.service.ts` is never imported (its repository and validator only by each other); `auth.controller.ts` does everything itself |
| Input validation | Zod in every controller | `matches` and `users` controllers read `req.body` without a schema; only `auth`, `reservations` and (inline) `tournaments` validate |
| Webhook safety | Signature check + idempotency via `mp_webhook_events` | No signature verification and no idempotency; the `mp_webhook_events` table is not in `schema.sql` |
| ELO | Worker computing ELO | `match.service.ts` applies a fixed ±15 on accepted ranked scores, non-transactional; there are no scheduled jobs |

## Agent workflow

Requirements come in through a Claude session. The main session **orchestrates**; the subagents in `.claude/agents/` execute. The `/implement <requirement>` command (`.claude/skills/implement/`) triggers the full flow:

1. `planner` → plan + API contract
2. **Checkpoint: the user approves the plan** (nothing is coded before that)
3. `db-agent` (only if there are schema changes; Supabase dev only)
4. `backend-dev` → implementation
5. `tester` → tests
6. `reviewer` → review (max. 2 rounds of fixes)
7. `pr-agent` → branch, commits and PR against `develop`

| Agent | Responsibility |
|---|---|
| `planner` | Plan and API contract. Read-only |
| `backend-dev` | Code in `src/` (domains, middleware, payments, sockets, jobs) |
| `db-agent` | Migrations, RLS, `docs/schema.sql`. Supabase dev only |
| `tester` | Tests. Does not modify production code |
| `reviewer` | Diff review. Does not modify code |
| `pr-agent` | Git and `gh`: branches, commits, PR |

Supporting skills: `new-domain`, `db-migration`, `pr-format`.

## Branches, environments and hard rules

- `main` is **production** (Render `match-padel-api`, Supabase `match-padel`). `develop` is the working branch (Render `match-padel-api-dev`, Supabase `match-padel-dev`).
- Every PR goes against `develop` and is merged with **squash**. `develop` → `main` uses a **merge commit** and is done by the human.
- Commits and PRs in **English**, conventional commits. See the `pr-format` skill.
- **Never** touch production (database, services, variables) from an agent session. Schema changes are applied in dev and the SQL for production is documented in the PR.
- If an API change affects `match-padel-web`, the API PR is merged first and the web PR references it under "Related PR".

## Documentation map

- `docs/endpoints.md` — every endpoint that is actually mounted today (method, path, auth, controller), unmounted stubs and known gaps. **Read it before planning.**
- `docs/architecture.md`, `docs/conventions.md`, `docs/implementing.md`, `docs/api-patterns.md` — target architecture and how-tos. Anything not built yet is marked "target — not implemented yet".
- `docs/schema.sql` — the full database schema (source of truth for dev; production may have drifted).
