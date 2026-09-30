# Endpoints — match-padel-api

Inventory of every HTTP endpoint that is mounted today. Derived from `src/index.ts` and the `*.router.ts` files it imports. This is the **real** state, not the target: see "Real state vs. target" in `CLAUDE.md`.

All API routes live under `/api/v1` (`v1` router in `src/index.ts`). Unless noted, successful responses use `{ success: true, data }`. Errors are produced by `errorHandler` in `src/middleware/error.middleware.ts`, which currently returns `{ error, message }` instead of the error envelope (see `docs/api-patterns.md`).

Auth column: `none` = public; `requireAuth` = Supabase JWT checked (no role or club-staff checks exist anywhere). Two versions of `requireAuth` are in use: `auth.ts` (throws `UnauthorizedError`, goes through the error handler) and `auth.middleware.ts` (canonical, answers 401 directly). Both set `req.userId` only.

## Non-versioned

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/health` | none | Health check, returns `{ status, timestamp }` (no envelope) | inline in `src/index.ts` |

## auth — `/api/v1/auth` (`auth.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | none | Create an unconfirmed Supabase auth user and profile, send the "Confirm signup" code by email; no session returned yet (`EMAIL_VERIFICATION_REQUIRED` flow — the client confirms with `supabase.auth.verifyOtp({ type: 'signup' })` directly, anon key, which returns the session) | `register` (`auth.controller.ts`) |
| POST | `/api/v1/auth/login` | none | Sign in with email and password, return user and tokens. `403 EMAIL_NOT_CONFIRMED` if the account hasn't verified its email yet | `login` |
| POST | `/api/v1/auth/logout` | requireAuth | Acknowledge logout (no server-side session invalidation) | `logout` |
| GET | `/api/v1/auth/me` | requireAuth | Current user profile | `me` |

## users — `/api/v1/users` (`user.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/users/me` | requireAuth | Current user profile | `getMe` (`user.controller.ts`) |
| PUT | `/api/v1/users/me` | requireAuth | Update current user profile | `updateMe` |
| POST | `/api/v1/users/me/avatar` | requireAuth | Upload a profile picture (multipart field `avatar`, JPEG/PNG/WebP, max 5MB) to the `avatars` Storage bucket and set `avatar_url` | `uploadAvatar` |
| GET | `/api/v1/users/me/stats` | requireAuth | Current user stats | `getMyStats` |
| GET | `/api/v1/users/me/elo-history` | requireAuth | Current user's last 50 ELO changes, newest first | `getMyEloHistory` |
| GET | `/api/v1/users/leaderboard` | none | Card #60: active players ranked by `elo` descending, paginated (`page`, `limit` up to 50), same public column set as a profile lookup. Registered before `/:username` so it isn't swallowed by it | `getLeaderboard` |
| GET | `/api/v1/users/:username` | none | Public profile by username | `getUserByUsername` |

## clubs — `/api/v1/clubs` (`club.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/clubs` | none | List clubs (paginated, `meta` with `totalPages`); includes `lat`/`lng` (nullable — for the map view, Trello card #49) | `getClubes` (`club.controller.ts`) |
| GET | `/api/v1/clubs/:id` | none | Club detail with courts; includes `lat`/`lng` | `getClubById` |
| GET | `/api/v1/clubs/:clubId/courts` | none | Courts of a club | `getClubCourts` |
| GET | `/api/v1/clubs/:clubId/availability?date=YYYY-MM-DD` | none | Combined slot availability across every active court of the club for one day — each slot lists the specific courts free at that time with their exact price, plus a `min_price` for a "starting from" display before a court is picked | `getClubAvailabilityHandler` (calls `getClubAvailability` in `club.service.ts`, which reuses `findAvailableSlots` per court) |

## courts — `/api/v1/courts` (`court.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/courts/:courtId/slots?date=YYYY-MM-DD` | none | Available time slots of a court for a date | `getAvailableSlots` (`reservations/reservation.controller.ts`) |

## reservations — `/api/v1/reservations` (`reservation.router.ts`)

`router.use(requireAuth)` (from `auth.middleware.ts`): every route requires auth.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/reservations` | requireAuth | My reservations (paginated) | `getMyReservations` (`reservation.controller.ts`) |
| GET | `/api/v1/reservations/:id` | requireAuth | Reservation detail | `getReservationById` |
| POST | `/api/v1/reservations` | requireAuth | Create a reservation (201) | `createReservation` |
| DELETE | `/api/v1/reservations/:id` | requireAuth | Cancel a reservation | `cancelReservationHandler` |

## matches — `/api/v1/matches` (`match.router.ts`)

`router.use(requireAuth)` (from `auth.ts`): every route requires auth.

Card #57: a match is tied to a real court reservation (`matches.reservation_id`) and its price is split 4 ways. Creating a match or joining one never adds a `match_players` row directly — both return a MercadoPago checkout link for that player's 1/4 share, and the player is only added once the webhook confirms the payment (see `payment.service.ts`). A match auto-cancels with full refunds if its court time passes without reaching 4 confirmed players (`src/jobs/auto-cancel-unfilled-matches.job.ts`).

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/matches` | requireAuth | My matches (filters `status`, `type`, `page`; no `meta`) | `getMyMatches` (`match.controller.ts`) |
| GET | `/api/v1/matches/:id` | requireAuth | Match detail (only participants or the creator, checked in the service) | `getMatch` |
| POST | `/api/v1/matches` | requireAuth | Create a match tied to a court/time slot (`type`, `is_ranked`, `court_id`, `start_time`, `end_time`); returns `{ match, payment }` — `payment` is a checkout link for the creator's 1/4 share (201) | `createMatch` |
| POST | `/api/v1/matches/join/:lobbyUrl` | requireAuth | Join a match by lobby URL; returns a checkout link for the caller's 1/4 share, not the match itself | `joinByLobbyUrl` |
| PUT | `/api/v1/matches/:id/score` | requireAuth | Card #58: submit the caller's team's claimed result (`score_team1`, `score_team2`); confirms automatically once both teams' drafts match exactly (applies ELO on ranked matches via `submit_match_score_draft`/`accept_match_score`), clears both drafts and counts a mismatch otherwise, permanently `disputed` after 3 mismatches. Replaces the old submit→accept/reject flow (cards #21/#51) | `submitScore` |
| DELETE | `/api/v1/matches/:id` | requireAuth | Creator cancels the whole match; releases the reservation and refunds every approved payment if it's still ≥24h before start, refunds nobody otherwise | `cancelMatch` |
| DELETE | `/api/v1/matches/:id/leave` | requireAuth | A player leaves their own spot; same 24h refund window as `cancelMatch`. If the match had reached 4/4, it drops back to `waiting` instead of being cancelled | `leaveMatch` |
| GET | `/api/v1/matches/:id/chat` | requireAuth | Card #59: chat messages for this match, oldest first (participants only) | `getMessages` (`chats/chat.controller.ts`) |
| POST | `/api/v1/matches/:id/chat` | requireAuth | Post a chat message (participants only) | `sendMessage` |

Card #59: `match_chats` already existed in the schema (unused until now). Plain REST, polled by the client — Socket.io isn't wired up in this deployment (`src/lib/socket.ts` is a no-op), so there's no push/realtime delivery yet.

## tournaments — `/api/v1/tournaments` (`tournament.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/tournaments` | none | List tournaments (`meta: { total }`) | `listTournaments` (`tournament.controller.ts`) |
| GET | `/api/v1/tournaments/:id` | none | Tournament detail | `getTournament` |
| POST | `/api/v1/tournaments` | requireAuth | Create a tournament (201); `club_id` is required, and the caller must be staff of that club (checked in the service) | `createTournament` |
| POST | `/api/v1/tournaments/:id/teams` | requireAuth | Register my team (me + `partner_id`) (201); notifies the partner | `registerTeam` |
| DELETE | `/api/v1/tournaments/:id/teams/me` | requireAuth | Withdraw my team | `withdrawTeam` |
| POST | `/api/v1/tournaments/:id/start` | requireAuth | Start the tournament (only its creator, checked in the service) | `startTournament` |

## notifications — `/api/v1/notifications` (`notification.router.ts`)

`router.use(requireAuth)` (from `auth.ts`): every route requires auth.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | requireAuth | My notifications (0-based `page`, `meta` with `hasMore`) | `getMyNotifications` (`notification.controller.ts`) |
| GET | `/api/v1/notifications/unread-count` | requireAuth | Unread count | `getUnreadCount` |
| PUT | `/api/v1/notifications/:id/read` | requireAuth | Mark one as read | `markAsRead` |
| PUT | `/api/v1/notifications/read-all` | requireAuth | Mark all as read | `markAllAsRead` |

## payments — `/api/v1/payments` (`payment.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| POST | `/api/v1/payments/preference` | requireAuth | Create a MercadoPago preference for a plain reservation (`reservation_id`), full price, caller must own it | `createPreference` (`payment.controller.ts`) |
| POST | `/api/v1/payments/webhook` | none (signature-verified) | MercadoPago notification; verifies `x-signature`, resolves the exact `payments` row by id (`external_reference`), checks the paid amount against it, deduped via `payments.mp_event_id`, responds 200 immediately and logs any processing error that happens after | `webhook` |

Card #57: `createMatchPaymentPreference(matchId, userId)` (not exposed directly — called from `match.service.ts`) creates a preference for a player's 1/4 share of a match's reservation. Every preference, single-payer or split, is created against a `payments` row inserted first so its id becomes the MercadoPago `external_reference` — the webhook always resolves the specific row by id, never by `reservation_id` alone. `refundPayment(paymentId)` calls MercadoPago's refund API and marks the row `refunded` on success.

## achievements — `/api/v1/achievements` (`achievements.router.ts`)

Card #54 — reads only; achievements are awarded from `accept_match_score` (see `docs/schema.sql`), not through this router.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/achievements` | none | Full achievement catalog | `getCatalog` |
| GET | `/api/v1/achievements/me` | requireAuth | Achievements the current user has earned | `getMyAchievements` |

## Unmounted routers

Not imported by `src/index.ts`, so none of their routes exist:

- Empty stubs with only a `TODO`: `clubs/clubs.router.ts`, `matches/matches.router.ts`, `reservations/reservations.router.ts`, `tournaments/tournaments.router.ts`, `users/users.router.ts`, `platform/platform.router.ts`.
- The dead `src/app.ts` imports those stubs and would mount `/api/v1/platform`, but it is not the entry point (`npm run dev` and `npm start` run `src/index.ts` / `dist/index.js`).

## Known gaps

Verified by reading the code (`src/index.ts`, the routers and `match-padel-web`):

- **No `/api/v1/platform/*` endpoints.** `docs/api-patterns.md` shows `super_admin` routes under `/platform/...`, but `platform.router.ts` is an empty stub and is not mounted. `requireRole` does not exist.
- **No club management endpoints.** There is no route to create or update clubs or courts, and no club-staff routes (`requireClubStaff` does not exist). The admin app (`match-padel-web/apps/admin`) reads and writes `clubs`, `court_reservations` and other tables directly with the Supabase client instead of this API.
- **No `GET /api/v1/clubs/:clubId/reservations`.** `src/app.ts` (dead) has the comment `/clubs/:clubId/reservations` next to a stub router; nothing serves it in `src/index.ts`.
- **No Socket.io server and no chat endpoints.** `src/lib/socket.ts` is a no-op and socket.io is not in `package.json`, although `docs/api-patterns.md` lists `match:*`, `staff:*` and `chat:message` events (`match_chats` exists in `docs/schema.sql`).
- Every call the player app makes today through `match-padel-web/apps/app` (`/auth/*`, `/clubs*`, `/courts/:id/slots`, `/reservations*`, `/payments/preference`, `/matches*`, `/users*`, `/tournaments*`, `/notifications*`) has a matching mounted route.

## Domain file inventory

Files present in `src/domains/<domain>/` (entity files use the singular name, e.g. `match.router.ts`). "yes" = exists and is used; "unused" = exists but nothing imports it.

| Domain | Mounted at | router | controller | service | repository | validator |
|---|---|---|---|---|---|---|
| auth | `/api/v1/auth` | yes | yes (holds logic and Supabase queries) | unused | unused | unused (`auth.validator.ts`; the controller defines its own schemas) |
| users | `/api/v1/users` | yes | yes | no | yes | no |
| clubs | `/api/v1/clubs` | yes | yes | no | yes | no (schema inline in the controller) |
| courts | `/api/v1/courts` | yes | no (reuses `reservation.controller.ts`) | no | no | no |
| reservations | `/api/v1/reservations` | yes | yes | yes | yes | yes |
| matches | `/api/v1/matches` | yes | yes | yes | yes | no |
| tournaments | `/api/v1/tournaments` | yes | yes | yes | yes | no (schemas inline in the controller) |
| notifications | `/api/v1/notifications` | yes | yes | yes | yes | no |
| payments | `/api/v1/payments` | yes | yes | yes (holds Supabase queries) | no | no (schema inline in the controller) |
| achievements | `/api/v1/achievements` | yes | yes | yes | yes | no |
| platform | not mounted | stub only | no | no | no | no |

No domain has a `__tests__/` folder.
