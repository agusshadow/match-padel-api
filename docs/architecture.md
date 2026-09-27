# Architecture — match-padel-api

## General pattern

Express monolith organized by business domains. No microservices. A single process, but each domain is self-contained internally.

## Domains and dependency order

```
auth ──────────────────────────────────────── base (no deps)
users ─────────────────────────────────────── depends on auth
clubs ─────────────────────────────────────── depends on auth, users
reservations ──────────────────────────────── depends on clubs, users
matches ───────────────────────────────────── depends on clubs, users, reservations
tournaments ───────────────────────────────── depends on clubs, matches
platform ──────────────────────────────────── depends on all (super_admin only)
```

Implement in that order. Do not implement a domain before its dependencies are complete.

Today's code also has the domains `courts`, `notifications` and `payments`, which are not in the dependency graph above. `platform` only has an empty router that is not mounted in `src/index.ts`. See `docs/endpoints.md` for what is actually mounted.

## Layers within each domain

```
Request HTTP
    │
    ▼
[Router]         — defines routes, chains auth middlewares, delegates to the controller
    │
    ▼
[Controller]     — validates input with Zod, calls the service, builds the response with the envelope
    │
    ▼
[Service]        — pure business logic; knows nothing about Express; may call repositories from other domains
    │
    ▼
[Repository]     — ONLY place with Supabase queries; returns typed DB types
    │
    ▼
[Supabase DB]
```

## Global modules (src/lib/)

| File | What it exports |
|---|---|
| `supabase.ts` | client with the `service_role` key — bypasses RLS |
| `logger.ts` | `logger` object with `info`/`debug`/`warn`/`error`; today it is a thin wrapper over `console`, not structured JSON, and nothing imports it yet. Target: structured JSON to stdout |
| `mercadopago.ts` | exports `mp` (the `MercadoPagoConfig`, reads `MP_ACCESS_TOKEN`) and `preference` (a `Preference` instance) |
| `socket.ts` | exports `registerSocketHandlers`, a no-op stub (socket.io is not installed) |
| `firebase.ts` | initialized Firebase Admin SDK (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md) |

## Global modules (src/middleware/)

| File | What it does |
|---|---|
| `auth.middleware.ts` | canonical. Exports `requireAuth` (verifies the Supabase JWT, sets `req.userId`) and the `AuthRequest` type |
| `error.middleware.ts` | canonical. Exports `errorHandler` (catch-all) and `notFound`; mounted in `src/index.ts` |
| `auth.ts`, `error.ts` | duplicates of the two files above (most routers still import `auth.ts`); `error.ts` is not mounted and is the one that emits the full error envelope |
| `rate-limiter.middleware.ts` | exports `rateLimiter`; only used by the dead `src/app.ts`. The real rate limit is inline in `src/index.ts` (200 requests per 15 min, global) |
| `requireRole` | checks `users.role` (only for `super_admin`) (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md) |
| `requireClubStaff` | checks presence in the `club_staff` table with the required role (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md) |

Middleware files are named `<name>.middleware.ts`. Per-tier rate limiting (100/min per IP, 1000/min per user, 5/min on sensitive endpoints) (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md).

## Flow of a typical request

```
PUT /api/v1/matches/:id/score/accept
    │
    ├─ requireAuth           → verifies JWT, adds req.user
    ├─ requireClubStaff      → not applicable (the player is the one accepting) (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
    │
    ▼
MatchesController.acceptScore(req, res)
    ├─ validates params with Zod
    ├─ calls MatchesService.acceptScore(matchId, userId)
    │
    ▼
MatchesService.acceptScore(matchId, userId)
    ├─ MatchesRepository.findById(matchId)
    ├─ validates match status (must be 'disputed')
    ├─ MatchesRepository.updateStatus(matchId, 'finished')
    ├─ calculateElo(matchId)          ← direct async function, not EventEmitter
    │   └─ RankingRepository.upsertRankings(...)  ← atomic transaction
    └─ notifyPlayers(matchId)         ← Firebase FCM
    │
    ▼
Controller returns { success: true, data: { match, eloDeltas } }
```

The diagram above is the target flow. Today: the handler is the function `acceptScore` in `match.controller.ts` (no class); `matchService.acceptScore` (in `match.service.ts`) only accepts a pending score, and for ranked matches applies a fixed +15/-15 ELO delta through `matchRepository` (`_applyEloChanges`, writes `users.elo` and `elo_history`, not in a transaction). `calculateElo`, `RankingRepository` and the ELO worker (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md). Player notifications are rows in the `notifications` table created through `notification.service.ts`; Firebase FCM push (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md). The controller returns the updated match as `{ success: true, data: match }`.

## Key technical decisions

- **No EventEmitter**: the ELO calculation is an async function called directly. If it takes a while, the client waits (at most ~200ms for the calculation + 4 writes in a transaction).
- **service_role in the backend**: the Supabase client in the API uses `service_role` and bypasses RLS completely. Security is the responsibility of the Express middlewares.
- **CRON jobs outside the process**: scheduled jobs live in Supabase Edge Functions, not in node-cron inside Express. If the Express process dies, the jobs keep running. (No scheduled jobs exist in this repository today.)
- **A single Supabase client**: instantiated in `src/lib/supabase.ts`, imported by all repositories. Do not create new instances.
