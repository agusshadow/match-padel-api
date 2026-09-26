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
| `logger.ts` | structured JSON logger (pino or similar) |
| `mercadopago.ts` | configured instance of the MP SDK |
| `firebase.ts` | initialized Firebase Admin SDK |

## Global modules (src/middleware/)

| File | What it does |
|---|---|
| `requireAuth.ts` | verifies the Supabase JWT, adds `req.user` |
| `requireRole.ts` | checks `users.role` (only for `super_admin`) |
| `requireClubStaff.ts` | checks presence in the `club_staff` table with the required role |
| `rateLimiter.ts` | express-rate-limit configured per tier |
| `errorHandler.ts` | catch-all for errors, builds the error envelope |

## Flow of a typical request

```
POST /api/v1/matches/:id/scores/accept
    │
    ├─ requireAuth           → verifies JWT, adds req.user
    ├─ requireClubStaff      → not applicable (the player is the one accepting)
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

## Key technical decisions

- **No EventEmitter**: the ELO calculation is an async function called directly. If it takes a while, the client waits (at most ~200ms for the calculation + 4 writes in a transaction).
- **service_role in the backend**: the Supabase client in the API uses `service_role` and bypasses RLS completely. Security is the responsibility of the Express middlewares.
- **CRON jobs outside the process**: scheduled jobs live in Supabase Edge Functions, not in node-cron inside Express. If the Express process dies, the jobs keep running.
- **A single Supabase client**: instantiated in `src/lib/supabase.ts`, imported by all repositories. Do not create new instances.
