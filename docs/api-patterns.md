# API Patterns — match-padel-api

## Base URL
```
/api/v1/
```

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

Domain-specific codes follow the `ENTITY_REASON` pattern: `MATCH_NOT_FOUND`, `COURT_NOT_AVAILABLE`, `ELO_CALCULATION_FAILED`.

## Authentication

All protected routes require:
```
Authorization: Bearer <supabase_jwt>
```

The `requireAuth` middleware verifies the JWT against Supabase and adds `req.user`:
```typescript
req.user = {
  id: string,       // users.id (UUID)
  email: string,
  role: 'user' | 'super_admin'
}
```

## RBAC — middleware chain

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

## Realtime (Supabase)

Only the `court_reservations` table has Realtime enabled. It publishes only: `id`, `court_id`, `start_time`, `end_time`, `status`. Nothing else.

The frontend subscribes directly to Supabase for court availability. Everything else uses Socket.io against the API.

## Socket.io

Events emitted by the API:
| Event | Room | When |
|---|---|---|
| `match:player_joined` | `match:{id}` | Player joins the match |
| `match:score_loaded` | `match:{id}` | Score is loaded |
| `match:elo_ready` | `match:{id}` | ELO calculated and persisted |
| `staff:new_payment` | `club:{id}` | Payment received at the club |
| `chat:message` | `match:{id}` | Message in the match chat |

Socket auth: the client sends the JWT in the handshake. The server verifies it before allowing a join to any room.

## Webhooks MercadoPago

- Endpoint: `POST /api/v1/payments/webhook`
- No JWT authentication (MP does not support it), but with `x-signature` signature verification
- Idempotent: check `mp_webhook_events.mp_event_id` before processing
- Always respond 200 (even on internal error) to avoid infinite retries from MP
