# API Patterns — match-padel-api

## Base URL
```
/api/v1/
```

For the list of endpoints that are actually mounted today, see [`docs/endpoints.md`](endpoints.md).

## Response envelope

Every API response has this shape. No exceptions.

**Success:**
```json
{
  "success": true,
  "data": { }
}
```

**Success with pagination:**
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human-readable description for the user",
    "details": { }
  }
}
```

## Standard error codes

| Code | HTTP | When to use it |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/params fail the Zod schema |
| `UNAUTHORIZED` | 401 | JWT missing or invalid |
| `FORBIDDEN` | 403 | Valid JWT but no permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Already exists (duplicate email, court taken) |
| `INTERNAL_ERROR` | 500 | Unexpected error |

Domain-specific codes follow the `ENTITY_REASON` pattern: `MATCH_NOT_FOUND`, `COURT_NOT_AVAILABLE`, `ELO_CALCULATION_FAILED` (examples of the pattern; none of these three is defined in the code today).

Reality today: the classes in `src/types/errors.ts` (`AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`) produce `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` and `VALIDATION_ERROR`. `INTERNAL_ERROR` is only emitted by the duplicate `src/middleware/error.ts`. Domain codes in use include `USERNAME_TAKEN`, `INVALID_CREDENTIALS`, `INVALID_STATUS`, `MATCH_NOT_OPEN`, `ALREADY_JOINED`, `MATCH_FULL`, `MATCH_CANCELLED`, `SCORE_ACCEPTED`, `NO_PENDING_SCORE`, `MATCH_COMPLETED`, `TOURNAMENT_NOT_OPEN`, `TOURNAMENT_FULL`, `TOURNAMENT_COMPLETED`, `NOT_REGISTERED` and `NOT_ENOUGH_TEAMS`. The error handler mounted in `src/index.ts` (`src/middleware/error.middleware.ts`) currently responds with `{ error, message }` (and `details` for Zod errors) instead of the error envelope, and `requireAuth` from `auth.middleware.ts` responds `{ error: 'Unauthorized', message }`. The envelope above is the contract for new code.

## Authentication

All protected routes require:
```
Authorization: Bearer <supabase_jwt>
```

The `requireAuth` middleware verifies the JWT against Supabase (`supabase.auth.getUser`) and adds `req.user` (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md):
```typescript
req.user = {
  id: string,       // users.id (UUID)
  email: string,
  role: 'player' | 'club_staff' | 'super_admin'   // users.role (enum user_role in schema.sql)
}
```

Today `requireAuth` only sets `req.userId` (a string); `req.user`, the role and the email are not populated. Read it with `(req as AuthRequest).userId` (from `auth.middleware.ts`) or `(req as AuthenticatedRequest).userId` (from `auth.ts`).

## RBAC — middleware chain

Only `requireAuth` exists today. `requireRole` and `requireClubStaff` (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md); the `platform` router is an empty stub and is not mounted. The chains below are the target.

```typescript
// Public route
router.get('/clubs', clubsController.list)

// Requires authentication
router.get('/reservations', requireAuth, reservationsController.list)

// super_admin only
router.get('/platform/clubs', requireAuth, requireRole(['super_admin']), platformController.listClubs)

// Club staff with a specific role only
router.post(
  '/:clubId/courts',
  requireAuth,
  requireClubStaff('clubId', ['owner', 'manager']),
  courtsController.create
)
```

`requireClubStaff` receives the name of the URL param that contains the `clubId` and queries the `club_staff` table.

## Pagination

Standard query params: `?page=1&limit=20`

The repository receives `{ page, limit }` and returns `{ data, total }`. The service computes `totalPages` and the controller builds the `meta`.

Today the controller computes `totalPages` (clubs, reservations). Deviations: notifications use a 0-based `page` and return `meta: { total, page, limit, hasMore }`; tournaments return `meta: { total }` only; matches accept a `page` query param but return no `meta`.

## Realtime (Supabase)

Only the `court_reservations` table has Realtime enabled. It publishes only: `id`, `court_id`, `start_time`, `end_time`, `status`. Nothing else.

The frontend subscribes directly to Supabase for court availability. Everything else uses Socket.io against the API.

## Socket.io

Socket.io is not installed and `src/lib/socket.ts` is a no-op stub (`registerSocketHandlers`); nothing is emitted today. The events below are the target (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md).

Events emitted by the API:
| Event | Room | When |
|---|---|---|
| `match:player_joined` | `match:{id}` | Player joins the match |
| `match:score_loaded` | `match:{id}` | Score is loaded |
| `match:elo_ready` | `match:{id}` | ELO calculated and persisted |
| `staff:new_payment` | `club:{id}` | Payment received at the club |
| `chat:message` | `match:{id}` | Message in the match chat |

Socket auth: the client sends the JWT in the handshake. The server verifies it before allowing a join to any room. (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)

## Webhooks MercadoPago

- Endpoint: `POST /api/v1/payments/webhook`
- No JWT authentication (MP does not support it), but with `x-signature` signature verification (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
- Idempotent: check `mp_webhook_events.mp_event_id` before processing (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
- Always respond 200 (even on internal error) to avoid infinite retries from MP (today the controller sends 200 first and then processes the notification; see `docs/implementing.md`)
