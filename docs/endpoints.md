# Endpoints — match-padel-api

Inventory of every HTTP endpoint that is mounted today. Derived from `src/index.ts` and the `*.router.ts` files it imports. This is the **real** state, not the target: see "Real state vs. target" in `CLAUDE.md`.

All API routes live under `/api/v1` (`v1` router in `src/index.ts`). Unless noted, successful responses use `{ success: true, data }`. Errors are produced by `errorHandler` in `src/middleware/error.middleware.ts`, which currently returns `{ error, message }` instead of the error envelope (see `docs/api-patterns.md`).

Auth column: `none` = public; `requireAuth` = Supabase JWT checked, no role check; `requireRole([...])` = platform role (superadmin passes any list); `requireClubRole([...])` = role in the club of `:clubId` (a platform superadmin always passes). See `docs/permissions.md` for the matrix. `requireAuth` lives in `src/middleware/auth.ts` and sets `req.userId`; the role middleware in `src/middleware/access.middleware.ts` (card #66) loads the platform role and club memberships once per request into `req.access` / `req.platformRole` / `req.clubRole`.

## Non-versioned

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/health` | none | Health check, returns `{ status, timestamp }` (no envelope) | inline in `src/index.ts` |

## auth — `/api/v1/auth` (`auth.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | none | Body `{ email, password (min 8), first_name, last_name, username (3-20, `[a-z0-9_]`), phone?, skill_level?, preferred_hand? }` — `skill_level`/`preferred_hand` are optional since card #67 so a club owner can register from the club panel (the club panel registers owners with this endpoint, confirms the email code, logs in, then calls `POST /me/clubs`). Create an unconfirmed Supabase auth user and profile, send the "Confirm signup" code by email; no session returned yet (`EMAIL_VERIFICATION_REQUIRED` flow — the client confirms with `supabase.auth.verifyOtp({ type: 'signup' })` directly, anon key, which returns the session) | `register` (`auth.controller.ts`) |
| POST | `/api/v1/auth/login` | none | Sign in with email and password, return user and tokens. `403 EMAIL_NOT_CONFIRMED` if the account hasn't verified its email yet | `login` |
| POST | `/api/v1/auth/logout` | requireAuth | Acknowledge logout (no server-side session invalidation) | `logout` |
| GET | `/api/v1/auth/me` | requireAuth | Current user profile | `me` |

## users — `/api/v1/users` (`user.router.ts`)

Card #61: `users.xp`/`users.level` (engagement, separate from `elo` which is skill/ranked-only) ride along in every profile response below (`PROFILE_COLUMNS`/`PROFILE_COLUMNS_FULL`) — no separate endpoint. XP is awarded by `award_match_xp` inside `accept_match_score` whenever a result is confirmed (20 XP for playing, 30 for winning, ranked or friendly); level is derived from cumulative XP via `level_for_xp`.

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
| GET | `/api/v1/clubs` | none | Card #67: every public club read (this section, `/courts/:courtId/slots`, `POST /reservations`, `/matches` creation, `/tournaments` list and detail) only sees clubs with `status = 'approved'` and `is_active`; anything else answers as if it did not exist. List clubs (paginated, `meta` with `totalPages`); includes `lat`/`lng` (nullable — for the map view, Trello card #49) | `getClubes` (`club.controller.ts`) |
| GET | `/api/v1/clubs/:id` | none | Club detail with courts; includes `lat`/`lng` | `getClubById` |
| GET | `/api/v1/clubs/:clubId/courts` | none | Courts of a club | `getClubCourts` |
| GET | `/api/v1/clubs/:clubId/availability?date=YYYY-MM-DD` | none | Combined slot availability across every active court of the club for one day — each slot lists the specific courts free at that time with their exact price, plus a `min_price` (lowest hourly rate) and, since card #70, a `min_total_price` (lowest total of the slot) for a "starting from" display. Each court entry has `price_per_hour` (rate applied at that slot: price rule, else the court's base price) and `price` (total of the slot). Hours, exceptions and prices follow `docs/availability-and-pricing.md`. Card #71: a slot blocked on a court is not offered for that court (blocks: `docs/availability-and-pricing.md`) | `getClubAvailabilityHandler` (calls `getClubAvailability` in `club.service.ts`, which reuses `findAvailableSlots` per court) |

## courts — `/api/v1/courts` (`court.router.ts`)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/courts/:courtId/slots?date=YYYY-MM-DD` | none | Time slots of a court for a club-local date: `[{ start_time, end_time, available, price_per_hour, price, unavailable_reason }]` (card #70: from the effective schedule, `price` = total of the slot with the price rules applied; closed days and exceptions return `[]`). Card #71: `unavailable_reason` is `null` when `available` is true, else `'past'`, `'booked'` or `'blocked'` (the club blocked the court for that time; the block's own reason is never exposed) | `getAvailableSlots` (`reservations/reservation.controller.ts`) |

## reservations — `/api/v1/reservations` (`reservation.router.ts`)

`router.use(requireAuth)` (from `auth.middleware.ts`): every route requires auth.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/reservations` | requireAuth | My reservations (paginated) | `getMyReservations` (`reservation.controller.ts`) |
| GET | `/api/v1/reservations/:id` | requireAuth | Reservation detail | `getReservationById` |
| POST | `/api/v1/reservations` | requireAuth | Create a reservation (201). Card #70: the range must be whole, contiguous slots of the court's effective schedule, else 409 `OUTSIDE_SCHEDULE`, or 409 `COURT_CLOSED` on a closed exception; `total_price` is computed on the server from the price rules (sum of the slot prices) and stored, never rewritten by later rule changes. Card #71: 409 `COURT_BLOCKED` when the club blocked the court for that time | `createReservation` |
| DELETE | `/api/v1/reservations/:id` | requireAuth | Cancel a reservation (the player's own; sets `cancelled` and notifies, it does not refund payments: unchanged by card #71, whose club-initiated cancellation refunds in full) | `cancelReservationHandler` |

## matches — `/api/v1/matches` (`match.router.ts`)

`router.use(requireAuth)` (from `auth.ts`): every route requires auth.

Card #57: a match is tied to a real court reservation (`matches.reservation_id`) and its price is split 4 ways. Creating a match or joining one never adds a `match_players` row directly — both return a MercadoPago checkout link for that player's 1/4 share, and the player is only added once the webhook confirms the payment (see `payment.service.ts`). A match auto-cancels with full refunds if its court time passes without reaching 4 confirmed players (`src/jobs/auto-cancel-unfilled-matches.job.ts`).

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/matches` | requireAuth | My matches (filters `status`, `type`, `page`; no `meta`) | `getMyMatches` (`match.controller.ts`) |
| GET | `/api/v1/matches/:id` | requireAuth | Match detail (only participants or the creator, checked in the service) | `getMatch` |
| POST | `/api/v1/matches` | requireAuth | Create a match tied to a court/time slot (`type`, `is_ranked`, `court_id`, `start_time`, `end_time`); returns `{ match, payment }` — `payment` is a checkout link for the creator's 1/4 share (201). Card #71: 409 `COURT_BLOCKED` when the club blocked the court for that time | `createMatch` |
| POST | `/api/v1/matches/join/:lobbyUrl` | requireAuth | Join a match by lobby URL; returns a checkout link for the caller's 1/4 share, not the match itself | `joinByLobbyUrl` |
| PUT | `/api/v1/matches/:id/score` | requireAuth | Card #58: submit the caller's team's claimed result (`score_team1`, `score_team2`); confirms automatically once both teams' drafts match exactly (applies ELO on ranked matches via `submit_match_score_draft`/`accept_match_score`), clears both drafts and counts a mismatch otherwise, permanently `disputed` after 3 mismatches. Replaces the old submit→accept/reject flow (cards #21/#51) | `submitScore` |
| DELETE | `/api/v1/matches/:id` | requireAuth | Creator cancels the whole match; releases the reservation and refunds every approved payment if it's still ≥24h before start; under 24h, credits half each share back as internal currency instead (card #63) | `cancelMatch` |
| DELETE | `/api/v1/matches/:id/leave` | requireAuth | A player leaves their own spot; same 24h window as `cancelMatch` (real refund ≥24h, half-share currency credit under 24h). If the match had reached 4/4, it drops back to `waiting` instead of being cancelled | `leaveMatch` |
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
| POST | `/api/v1/payments/webhook` | none (signature-verified) | MercadoPago notification; verifies `x-signature`, resolves the exact `payments` row by id (`external_reference`), checks the paid amount against it, deduped via `payments.mp_event_id`, responds 200 immediately and logs any processing error that happens after. Card #63: an `external_reference` prefixed `currency:` is a `currency_purchases` row instead (top-up of the internal currency), handled by a separate branch | `webhook` |

Card #57: `createMatchPaymentPreference(matchId, userId)` (not exposed directly — called from `match.service.ts`) creates a preference for a player's 1/4 share of a match's reservation. Every preference, single-payer or split, is created against a `payments` row inserted first so its id becomes the MercadoPago `external_reference` — the webhook always resolves the specific row by id, never by `reservation_id` alone. `refundPayment(paymentId)` calls MercadoPago's refund API and marks the row `refunded` on success.

## achievements — `/api/v1/achievements` (`achievements.router.ts`)

Card #54 — reads only; achievements are awarded from `accept_match_score` (see `docs/schema.sql`), not through this router.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/achievements` | none | Active achievement catalog (card #78: deactivated ones are not listed) | `getCatalog` |
| GET | `/api/v1/achievements/me` | requireAuth | Achievements the current user has earned (also the ones deactivated since) | `getMyAchievements` |

## challenges — `/api/v1/challenges` (`challenges.router.ts`)

Card #62 — reads only; assignment/expiration runs from `assign_and_expire_challenges` via `src/jobs/assign-and-expire-challenges.job.ts` (every 15 min), progress increments from `increment_challenge_progress` inside `accept_match_score`. Distinct from `achievements` (fixed one-time unlocks) — challenges rotate by cadence (`daily`/`weekly`/`monthly`/`one_time`) with per-user progress. Only two action types exist today (`play_matches`, `win_matches`); `reach_level`/`complete_profile`-style challenges aren't implemented (documented gap, not built). `reward_currency` is now paid out too (card #63).

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/challenges` | none | Full active challenge catalog | `getCatalog` (`challenges.controller.ts`) |
| GET | `/api/v1/challenges/me` | requireAuth | Current user's active + completed challenges with progress | `getMyChallenges` |

## marketplace — `/api/v1/marketplace` (`marketplace.router.ts`)

Card #63: cosmetics (palette skins, avatar frames, emblems) bought with an internal currency (`users.points_balance`, ledgered in `points_transactions`, reactivating that previously-dormant table). Currency is earned via challenge rewards (card #62) or bought with real money — one fixed pack for now (100 currency for $500 ARS, `CURRENCY_PACK` in `payment.service.ts`). A late (<24h) match cancellation (card #57) also credits half the share back as currency instead of a real refund.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/marketplace/cosmetics` | none | Full active cosmetics catalog | `getCatalog` (`marketplace.controller.ts`) |
| GET | `/api/v1/marketplace/cosmetics/me` | requireAuth | Cosmetics the current user owns | `getMyCosmetics` |
| GET | `/api/v1/marketplace/equipped` | requireAuth | The 3 equip slots (`equipped_palette_cosmetic_id`/`equipped_avatar_cosmetic_id`/`equipped_emblem_cosmetic_id`) plus, since card #78, the cosmetic itself per slot: `palette`, `avatar`, `emblem` (`{ id, code, name, description, type, image_url, price_currency }` or `null`), also when it has been deactivated | `getMyEquipped` |
| GET | `/api/v1/marketplace/balance` | requireAuth | Current currency balance | `getMyBalance` |
| POST | `/api/v1/marketplace/cosmetics/:id/purchase` | requireAuth | Spend currency on an item (atomic via `purchase_cosmetic`); 409 `ALREADY_OWNED`, 409 `COSMETIC_INACTIVE` (card #78, deactivated item), 404 if it does not exist, 400 `INSUFFICIENT_BALANCE` | `purchaseCosmetic` |
| POST | `/api/v1/marketplace/cosmetics/:id/equip` | requireAuth | Equip an owned item (even if it was deactivated after the purchase, card #78); 403 `NOT_OWNED`, 404 if it does not exist | `equipCosmetic` |
| POST | `/api/v1/marketplace/currency/purchase` | requireAuth | MercadoPago checkout link for the currency pack; confirmed by the same `POST /payments/webhook`, resolved via a `currency:` prefix on `external_reference` since it isn't reservation-shaped | `purchaseCurrency` |

## me — `/api/v1/me` (`access.router.ts`, card #66)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/me/access` | requireAuth | What the caller can administer: `{ user: { id, email, first_name, last_name }, platformRole: 'superadmin' \| 'reviewer' \| null, clubs: [{ clubId, name, slug, isActive, status: 'draft' \| 'pending' \| 'changes_requested' \| 'approved' \| 'rejected' \| 'suspended', role: 'owner' \| 'admin' \| 'staff' \| 'superadmin' }] }`. A platform superadmin gets every club with role `superadmin`; anyone else only their `club_staff` memberships. `email` comes from Supabase Auth | `getAccess` (`access.controller.ts`) |
| POST | `/api/v1/me/clubs` | requireAuth (rate limit 10/min per IP) | Card #67. Body `{ name, address, city }` (strict). Creates a club in `draft` with a unique slug generated from the name, an `owner` membership for the caller, a `club_status_history` row (`null` to `draft`) and audit `club.created`. 201 with the club (same shape as `GET /club-admin/:clubId`); 200 with the existing club if the caller already has a draft with the same name, address and city (idempotent retry); 409 `CONFLICT` at 10 drafts owned by the caller | `createMyClub` (`club-admin.controller.ts`) |
| POST | `/api/v1/me/invitations/accept` | requireAuth (rate limit 10/min per IP) | Card #72. Body `{ token }` (strict, the raw token from the email link). Validates the SHA-256 hash, status and expiry and that the caller's Supabase Auth email (confirmed) equals the invited email, case-insensitive. Creates the `club_staff` membership with the invited role and marks the invitation accepted, in one transaction (RPC `accept_club_invitation`); a caller who is already a member keeps their role. 200 `{ clubId, role }`; idempotent for the person who accepted. 404 `INVITATION_INVALID` (unknown, revoked or accepted by someone else: same answer), 403 `INVITATION_EMAIL_MISMATCH`, 403 `EMAIL_NOT_CONFIRMED`, 410 `INVITATION_EXPIRED`. Audited (`team.invitation_accepted`) | `acceptInvitation` (`team.controller.ts`) |

## club-admin — `/api/v1/club-admin/:clubId` (`club-admin.router.ts`, card #66)

The club panel's API. `:clubId` must be a UUID (400 otherwise); the caller needs a role in that club (403 `FORBIDDEN` otherwise; a platform superadmin is always allowed). Roles: owner = Dueño, admin = Administrador, staff = Recepción. Lists answer `{ success, data, meta: { page, limit, total, totalPages } }` (`page` default 1, `limit` default 20, max 100). Writes are audited in `audit_log`.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/club-admin/:clubId/summary` | requireClubRole owner/admin/staff | Counts: `courts`, `reservations: { total, pending, today }` (today = UTC-3 calendar day), `matches`, plus `recentReservations` (last 5 created, with court and player). 404 if the club does not exist | `getSummary` (`club-admin.controller.ts`) |
| GET | `/api/v1/club-admin/:clubId/reservations?status=&page=&limit=` | requireClubRole owner/admin/staff | Reservations of the club's courts, newest start first; `status` is `pending`/`confirmed`/`cancelled`/`completed` | `listReservations` |
| PATCH | `/api/v1/club-admin/:clubId/reservations/:id` | requireClubRole owner/admin/staff | Body `{ status: 'confirmed' \| 'cancelled' \| 'completed' }`. 404 if the reservation's court is not in this club. Allowed transitions: `pending` to `confirmed`/`cancelled`, `confirmed` to `cancelled`/`completed`; anything else is 409 `CONFLICT`; the same status is a no-op. Card #72: reception (`staff`) can only send `cancelled` (403 `FORBIDDEN` for `confirmed`/`completed`). `confirmed`/`completed` are audited as `reservation.status_changed`. Card #71: `cancelled` runs the same logic as `POST .../cancel` (full refund, match cancelled with it, players notified, audit `reservation.cancelled_by_club`) and the response is the reservation row plus `refund` and `match` (see below) | `updateReservation` |
| GET | `/api/v1/club-admin/:clubId/calendar?from=&to=&courtId=` | requireClubRole owner/admin/staff | Card #71. `from`/`to` ISO 8601 instants with offset (`to` after `from`, max 14 days; 400 otherwise), `courtId` optional (`court_id` also accepted; 404 if not of the club). One payload: `{ from, to, timezone, courts: [{ court: { id, name, surface, is_indoor, is_active }, days: [{ date, day_of_week, closed, closed_reason, source, open_hours: [{ start_time, end_time, start, end, slot_minutes }] }], reservations: [{ id, status, start_time, end_time, user: { id, first_name, last_name, username } \| null, total_price, payment: { status: 'unpaid' \| 'partial' \| 'paid' \| 'refunded', paid_amount }, match: { id, type, is_ranked, status } \| null, players_count: number \| null }], blocks: [{ id, club_id, court_id, start_time, end_time, reason, created_by, created_at }] }] }`. Every court of the club (or the one asked for). `reservations` are `pending`/`confirmed`/`completed` overlapping the range (cancelled ones are left out). `open_hours` per club-local day are the contiguous open windows of the effective schedule (`start`/`end` club-local `HH:MM`, `start_time`/`end_time` UTC); time outside them is closed. `players_count` = confirmed players of the match, null for a plain reservation | `getCalendar` |
| PATCH | `/api/v1/club-admin/:clubId/reservations/:id/move` | requireClubRole owner/admin/staff | Card #71. Body `{ court_id?, start_time, end_time }` (strict, ISO instants; `court_id` omitted = same court). Returns the reservation row (same shape as the list, with the new `court`). Rules: reservation must be `pending`/`confirmed` and not ended (409 `CANNOT_MOVE`); `start_time` in the future (400); same duration as the reservation (400, `details.duration_minutes`); target court of this club (404) and active (409 `COURT_INACTIVE`); whole slots of the target court's effective schedule (409 `OUTSIDE_SCHEDULE` / `COURT_CLOSED`); no block (409 `COURT_BLOCKED`); no other pending/confirmed reservation (409 `SLOT_TAKEN`). The price stays as charged and the status is unchanged. A move to the identical court and time is a no-op. Audited (`reservation.moved`, `from`/`to`); the booker and the match players get an in-app notification (type `system`, `data.kind = 'reservation_moved'`) | `moveReservation` |
| POST | `/api/v1/club-admin/:clubId/reservations/:id/cancel` | requireClubRole owner/admin/staff | Card #71. Body `{ reason? }` (strict, max 300). 200 `{ ...reservationRow, status: 'cancelled', refund: { payments, refunded, failed: [paymentId], amount_refunded }, match: { id, status: 'cancelled' } \| null }`. Always refunds 100% of every approved payment (any time left, no late-cancellation currency), never penalizes the player; a reservation of a match cancels the match too. 409 `CANNOT_CANCEL` (already cancelled/completed), 409 `MATCH_COMPLETED`. A refund MercadoPago rejects stays `approved` and is listed in `refund.failed` and the audit (`reservation.cancelled_by_club`). Notifies the booker and the match players (`reservation_cancelled`, `data.cancelled_by = 'club'`) | `cancelReservation` |
| GET | `/api/v1/club-admin/:clubId/blocks?court_id=&from=&to=` | requireClubRole owner/admin/staff | Card #71. Blocks overlapping the range (`from` defaults to now, max 500): `[{ id, club_id, court_id, start_time, end_time, reason, created_by, created_at }]` | `listBlocks` |
| POST | `/api/v1/club-admin/:clubId/blocks` | requireClubRole owner/admin | Card #71. Body `{ court_ids: [uuid] (1-50), start_time, end_time, reason? (max 200) }` (strict, ISO instants, max 365 days, must end in the future). One row per court, created atomically. 201 `{ blocks: [...] }` (same shape as the list). 409 `BLOCK_CONFLICTS` with `details.conflicts` when it overlaps pending/confirmed reservations or existing blocks on any court (nothing is created): `[{ type: 'reservation', id, court_id, start_time, end_time, status, user: { id, first_name, last_name, username } \| null, match_id \| null } \| { type: 'block', id, court_id, start_time, end_time, reason }]`. 404 for a court not of the club; 409 when the club is not editable. Audited (`court_block.created`) | `createBlocks` |
| DELETE | `/api/v1/club-admin/:clubId/blocks/:id` | requireClubRole owner/admin | Card #71. `{ id }`; 404 if it is not in this club. Audited (`court_block.deleted`) | `deleteBlock` |
| GET | `/api/v1/club-admin/:clubId/matches?page=&limit=` | requireClubRole owner/admin | Matches whose `club_id` is this club, with reservation/court and players | `listMatches` |
| GET | `/api/v1/club-admin/:clubId/tournaments?page=&limit=` | requireClubRole owner/admin | Tournaments of the club, with a `teams: [{ count }]` registration count | `listTournaments` |
| GET | `/api/v1/club-admin/:clubId` | requireClubRole owner/admin/staff | Club data (`name`, `slug`, `description`, `address`, `city`, `phone`, `email`, `logo_url`, `cover_url`, `lat`, `lng`, `is_active`, `status`, `legal_name`, `tax_id`, `opening_hours`, timestamps) | `getClub` |
| PATCH | `/api/v1/club-admin/:clubId` | requireClubRole owner/admin | Partial update of `name`, `description`, `address`, `city`, `phone`, `email`, `logo_url`, `cover_url`, `lat`, `lng`, `legal_name`, `tax_id` (card #67) and `opening_hours` (unknown fields are rejected, at least one required; nullable ones accept `null`). `opening_hours` is `{ mon?: [{ open: 'HH:MM', close: 'HH:MM' }], tue?, ..., sun? }` (`open < close`, `24:00` allowed as close, max 4 intervals a day, a missing or empty day is closed); it is stored in `clubs.settings.opening_hours` and is a draft: F2 replaces it with the per-court schedule model. 409 `CONFLICT` when the club is `pending`, `rejected` or `suspended`. Audited (`club.updated`, with the changed fields) | `updateClub` |
| GET | `/api/v1/club-admin/:clubId/onboarding` | requireClubRole owner/admin | Card #67. `{ status, steps: [{ key: 'club' \| 'location' \| 'contact' \| 'courts' \| 'schedule' \| 'documents', complete, missing: string[] }], canSubmit, history: [{ id, from_status, to_status, note, created_at, actor: { id, first_name, last_name } \| null }] (newest first), documents: [{ id, kind, file_name, mime_type, size_bytes, uploaded_by, created_at, url }] }`. `url` is a signed URL valid 10 minutes (`null` if it could not be signed) | `getOnboarding` |
| POST | `/api/v1/club-admin/:clubId/submit` | requireClubRole owner | Card #67. Moves the club from `draft` or `changes_requested` to `pending`; history + audit (`club.submitted`). Returns the club. 422 `APPLICATION_INCOMPLETE` with `details: { missing: ['club.legal_name', ...], steps }` when something is missing; 409 `CONFLICT` from any other status | `submitApplication` |
| GET | `/api/v1/club-admin/:clubId/courts` | requireClubRole owner/admin | Card #67. Courts of the club (all, active or not), ordered by name: `[{ id, club_id, name, surface, is_indoor, price_per_hour, is_active, created_at, updated_at }]` | `listCourts` |
| POST | `/api/v1/club-admin/:clubId/courts` | requireClubRole owner/admin | Body `{ name, surface: 'indoor' \| 'outdoor' \| 'panoramic', is_indoor? (default true), price_per_hour (> 0), is_active? (default true) }` (strict). 201 with the court. Audited (`court.created`). 409 when the club is not editable | `createCourt` |
| PATCH | `/api/v1/club-admin/:clubId/courts/:id` | requireClubRole owner/admin | Partial update of the same fields (at least one). 404 if the court is not in this club. Audited (`court.updated`). Card #70: the response is the court plus `warning: null | { code: 'COURT_HAS_FUTURE_RESERVATIONS', future_reservations }` (set when `is_active` goes to `false` and the court has pending/confirmed reservations from now on; nothing is cancelled) | `updateCourt` |
| DELETE | `/api/v1/club-admin/:clubId/courts/:id` | requireClubRole owner/admin | `{ id }`. 409 `CONFLICT` if the court has reservations (deactivate it instead). Audited (`court.deleted`) | `deleteCourt` |
| POST | `/api/v1/club-admin/:clubId/documents` | requireClubRole owner/admin | Multipart: file field `file` (PDF/JPEG/PNG/WebP, max 10 MB, content checked against its type) and text field `kind` (`tax_id` \| `company_registration` \| `id_document` \| `other`, default `other`). Stored in the private `club-documents` bucket under `<clubId>/<uuid>-<safe filename>`. 201 with the document (same shape as in `onboarding.documents`). Max 20 per club. 409 when the club is not editable. Audited (`club.document_uploaded`) | `uploadDocument` |
| DELETE | `/api/v1/club-admin/:clubId/documents/:id` | requireClubRole owner/admin | `{ id }`; removes the file and the row. 409 when the club is not editable. Audited (`club.document_deleted`) | `deleteDocument` |
| GET | `/api/v1/club-admin/:clubId/documents/:id/url` | requireClubRole owner/admin | `{ url, expiresIn: 600 }` (signed URL, 10 minutes). Platform staff use `GET /platform/clubs/:clubId/documents/:id/url` | `getDocumentUrl` |

| GET | `/api/v1/club-admin/:clubId/courts/:courtId/schedule` | requireClubRole owner/admin/staff | Card #70. `{ court_id, source: 'court' \| 'club' \| 'none', intervals: [{ day_of_week, open_time, close_time, slot_minutes }] }`. `source: 'club'` = the court has no rows and inherits the club's `opening_hours` (60 min slots). `day_of_week` 0 = Sunday ... 6 = Saturday, `HH:MM` club-local, `close_time` may be `24:00` | `getCourtSchedule` |
| PUT | `/api/v1/club-admin/:clubId/courts/:courtId/schedule` | requireClubRole owner/admin | Card #70. Body `{ intervals: [{ day_of_week, open_time, close_time, slot_minutes (30/60/90/120, default 60) }] }` (strict, max 28) replaces the whole weekly schedule atomically. 400 `VALIDATION_ERROR` with `details.errors` for overlaps, open >= close or an interval shorter than one slot. An empty list removes the court's own schedule (it inherits the club hours again). Same response as GET. Audited (`court.schedule_replaced`). 409 when the club is not editable | `replaceCourtSchedule` |
| GET | `/api/v1/club-admin/:clubId/schedule-exceptions?court_id=&from=&to=` | requireClubRole owner/admin/staff | Card #70. `[{ id, club_id, court_id (null = whole club), date, closed, open_time, close_time, slot_minutes, reason, created_by, created_at }]` by date; `from` defaults to today (club-local), max 500 rows | `listExceptions` |
| POST | `/api/v1/club-admin/:clubId/schedule-exceptions` | requireClubRole owner/admin | Card #70. Body `{ date, date_to? (inclusive, max 92 days), court_id? (null/omitted = whole club), closed? (default true), open_time?, close_time?, slot_minutes?, reason? }` (strict; `open_time`/`close_time` required when `closed` is false and rejected when true). Replaces any exception already set for the same court/club and dates. 201 `{ exceptions: [...], warning: null \| { code: 'EXCEPTION_HAS_RESERVATIONS', affected_reservations } }` (closing a day never cancels reservations). 400 for past dates. Audited (`schedule_exception.created`) | `createExceptions` |
| DELETE | `/api/v1/club-admin/:clubId/schedule-exceptions/:id` | requireClubRole owner/admin | Card #70. `{ id }`. 404 if it is not in this club. Audited (`schedule_exception.deleted`) | `deleteException` |
| GET | `/api/v1/club-admin/:clubId/courts/:courtId/price-rules` | requireClubRole owner/admin/staff | Card #70. `{ court_id, base_price_per_hour, rules: [{ id, name, days_of_week, start_time, end_time, price_per_hour, priority, is_active }] }` | `getPriceRules` |
| PUT | `/api/v1/club-admin/:clubId/courts/:courtId/price-rules` | requireClubRole owner/admin | Card #70. Body `{ rules: [{ name, days_of_week: [0..6], start_time, end_time (24:00 allowed), price_per_hour > 0, priority? (-100..100, default 0), is_active? (default true) }] }` (strict, max 30) replaces the set atomically. 400 `VALIDATION_ERROR` when two active rules share a day, overlap in time and have the same priority. Same response as GET. Audited (`court.price_rules_replaced`) | `replacePriceRules` |
| GET | `/api/v1/club-admin/:clubId/courts/:courtId/preview?date=YYYY-MM-DD` | requireClubRole owner/admin/staff | Card #70. What a player would be offered that day, before reservations: `{ court_id, date, day_of_week, source: 'court_exception' \| 'club_exception' \| 'court_schedule' \| 'club_hours' \| 'none', closed, closed_reason, base_price_per_hour, slots: [{ start_time, end_time (UTC ISO), start, end (club-local HH:MM), slot_minutes, price_per_hour, price, rule_id, rule_name }] }` | `previewCourtDay` |

Card #67 (and #70 for schedules, exceptions and price rules): club data, courts and documents can only be changed while the club is `draft`, `changes_requested` or `approved`; in `pending`, `rejected` and `suspended` the writes answer 409 `CONFLICT` with a message (reads keep working). See `docs/club-lifecycle.md`.
| GET | `/api/v1/club-admin/:clubId/team` | requireClubRole owner/admin | Card #72. `{ members: [{ user_id, first_name, last_name, username, email, role: 'owner' \| 'admin' \| 'staff', created_at }], invitations: [{ id, email, role: 'admin' \| 'staff', status: 'pending' \| 'expired', expires_at, created_at, invited_by }] }`. `email` comes from Supabase Auth; `created_at` of a member is when they joined; invitations are the open ones (pending and expired, newest first; accepted and revoked are not listed). Pending invitations past their deadline are marked `expired` on read | `listTeam` (`team.controller.ts`) |
| POST | `/api/v1/club-admin/:clubId/team/invitations` | requireClubRole owner (rate limit 20/min per IP) | Card #72. Body `{ email, role: 'admin' \| 'staff' }` (strict; `owner` is not invitable; email is trimmed and lower-cased). 201 `{ id, email, role, status: 'pending', expires_at (+7 days), created_at, invited_by, email_sent }`. `email_sent` is `true` only when the provider accepted the email; the invitation exists either way (use resend). 409 `ALREADY_MEMBER`, 409 `INVITATION_ALREADY_PENDING` (`details.invitation_id`), 409 `INVITATION_LIMIT` (50 pending). Audited (`team.invitation_created`) | `createInvitation` |
| POST | `/api/v1/club-admin/:clubId/team/invitations/:id/resend` | requireClubRole owner (rate limit 20/min per IP) | Card #72. Rotates the token (the old link stops working), sets it `pending` again and extends the expiry 7 days from now; same response as create. 404 if not of this club; 409 `INVITATION_ALREADY_ACCEPTED`, `INVITATION_REVOKED`, `ALREADY_MEMBER`. Audited (`team.invitation_resent`) | `resendInvitation` |
| DELETE | `/api/v1/club-admin/:clubId/team/invitations/:id` | requireClubRole owner | Card #72. Revokes a pending or expired invitation; 200 `{ id, email, role, status: 'revoked', expires_at, created_at, invited_by }` (already revoked: same answer). 409 `INVITATION_ALREADY_ACCEPTED` (remove the member instead). Audited (`team.invitation_revoked`) | `revokeInvitation` |
| PATCH | `/api/v1/club-admin/:clubId/team/members/:userId` | requireClubRole owner | Card #72. Body `{ role: 'admin' \| 'staff' }` (strict). 200 the member (same shape as in `GET /team`). 403 `CANNOT_MODIFY_OWNER`, 403 `CANNOT_MODIFY_SELF`, 404 if the user is not a member. Same role is a no-op (no audit). Audited (`team.member_role_changed`, `before`/`after`) | `changeMemberRole` |
| DELETE | `/api/v1/club-admin/:clubId/team/members/:userId` | requireClubRole owner | Card #72. Removes the membership; 200 `{ user_id }`. Same 403/404 as PATCH. Audited (`team.member_removed`) | `removeMember` |

## platform — `/api/v1/platform` (`platform.router.ts`, card #66)

`requireAuth` on the whole router and the role per route: a `reviewer` only reaches `GET /clubs` and the document URL below (card #67; the approve/reject/request-changes actions arrive with the review card); everything else is superadmin only. Lists answer with the `meta` envelope.

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/platform/summary` | requireRole superadmin | Global counts: `clubs`, `courts`, `reservations`, `pendingReservations`, `matches`, `users`, plus `recentReservations` (5) | `getSummary` (`platform.controller.ts`) |
| GET | `/api/v1/platform/clubs?search=&status=&page=&limit=` | requireRole reviewer (superadmin passes) | Superadmin: every club in every status, active or not (card #67); `status` filters by `draft` / `pending` / `changes_requested` / `approved` / `rejected` / `suspended`. Reviewer (card #68): only `pending` and `changes_requested` clubs; a `status` outside those is 403 `FORBIDDEN`. Rows include `status`, `legal_name`, `tax_id` | `listClubs` |
| POST | `/api/v1/platform/clubs` | requireRole superadmin | Body `{ name, slug (kebab-case), address, city, description?, phone?, email?, ownerUserId? }`. Creates the club as `approved` (card #67, with a status history row) (201); with `ownerUserId` it also creates an `owner` membership (400 if that user does not exist, the club insert is rolled back if the membership fails). 409 if the slug is taken. Audited (`club.created`) | `createClub` |
| GET | `/api/v1/platform/clubs/:clubId/documents/:id/url` | requireRole reviewer (superadmin passes) | Card #67. `{ url, expiresIn: 600 }`, a signed URL of an application document. 404 if the document is not in that club; a reviewer gets 404 for a club that is not `pending`/`changes_requested` (card #68) | `getClubDocumentUrl` |
| PATCH | `/api/v1/platform/clubs/:id/active` | requireRole superadmin | Body `{ isActive: boolean }`. 404 if the club does not exist. Audited (`club.activated`/`club.deactivated`) | `setClubActive` |
| GET | `/api/v1/platform/applications?status=&search=&page=&limit=` | requireRole reviewer (superadmin passes) | Card #68, applications inbox. `status`: one of the six statuses or `all`, default `pending` (`all` for a reviewer is `pending` + `changes_requested`; for a superadmin it is every status). A reviewer asking for any other status gets 403. `search` matches name, city, legal name and tax id. Order: oldest first when `pending`, latest activity first otherwise. Rows: `{ id, name, city, legal_name, tax_id, status, owner: { id, first_name, last_name, email } \| null, submitted_at, documents_count }`; `submitted_at` = last history entry to `pending` | `listApplications` |
| GET | `/api/v1/platform/applications/:clubId` | requireRole reviewer (superadmin passes) | Card #68. `{ club, owner, courts, documents, history, submitted_at, documents_expires_in }`: `club` = same shape as `GET /club-admin/:clubId` (all onboarding fields, `opening_hours`), `courts` = every court, `documents[].url` = signed URL valid 10 minutes, `history` = full status history newest first with `actor: { id, first_name, last_name } \| null`. 404 `NOT_FOUND` for a missing club and, for a reviewer, for a club that is not `pending`/`changes_requested` | `getApplication` |
| POST | `/api/v1/platform/applications/:clubId/approve` | requireRole reviewer (superadmin passes) | Card #68. Body `{ note? }` (5..2000 chars, strict). `pending` to `approved` (visible to players, while `is_active`). Returns the club. 409 `CONFLICT` if it is not `pending` or the status changed meanwhile. Writes history + audit `club.approved`; emails the owner (`approved`) | `approveApplication` |
| POST | `/api/v1/platform/applications/:clubId/request-changes` | requireRole reviewer (superadmin passes) | Card #68. Body `{ note }` (required, 5..2000). `pending` to `changes_requested`. Audit `club.changes_requested`; emails the owner the note | `requestChanges` |
| POST | `/api/v1/platform/applications/:clubId/reject` | requireRole reviewer (superadmin passes) | Card #68. Body `{ reason }` (required, 5..2000). `pending` to `rejected`. Audit `club.rejected`; emails the owner the reason | `rejectApplication` |
| POST | `/api/v1/platform/clubs/:clubId/reopen` | requireRole superadmin | Card #68. Body `{ note? }`. `rejected` to `draft` so the owner can fix and submit again. Audit `club.reopened`; no email | `reopenClub` |
| POST | `/api/v1/platform/clubs/:clubId/suspend` | requireRole superadmin | Card #68. Body `{ reason }` (required, 5..2000). `approved` to `suspended`; players stop seeing it. Audit `club.suspended`; emails the owner (`suspended`) | `suspendClub` |
| POST | `/api/v1/platform/clubs/:clubId/unsuspend` | requireRole superadmin | Card #68. Body `{ note? }`. `suspended` to `approved`. Audit `club.unsuspended`; emails the owner (`reinstated`) | `unsuspendClub` |
| GET | `/api/v1/platform/users?search=&page=&limit=` | requireRole superadmin | Users (`id`, `username`, `first_name`, `last_name`, `role`, `is_active`, `created_at`, `email`); `search` matches username and names, not email | `listUsers` |
| GET | `/api/v1/platform/audit-log?clubId=&actorId=&page=&limit=` | requireRole superadmin | `audit_log` entries, newest first, each with `actor` (`id, username, first_name, last_name`) and `club` (`id, name`) or `null` | `getAuditLog` |

### Gamification catalogs — `/api/v1/platform/catalogs` (`catalogs.router.ts`, card #78)

Mounted in `platform.router.ts` behind `requireRole(['superadmin'])`: a reviewer, a club role or a plain player gets 403. Field meaning and player-visible effect: `docs/catalogs.md`. Bodies and rows use the column names (snake_case), the same as the public catalogs. `code` is the immutable identity key (lowercase snake_case, 2..60). There is no delete; `is_active` is changed only through `activate`/`deactivate` (a PATCH that carries `code` or `is_active` is 400). Every write is audited (`catalog.<entity>_created` / `_updated` / `_activated` / `_deactivated`, entity `achievement`/`challenge`/`cosmetic`, `metadata: { code, before, after }`; `_updated` only lists the changed fields; a no-op PATCH or an already-in-state activate writes nothing). Single-item responses are the row plus `usage` (counts of players that own / have progress on it). Lists: `?page=&limit=` (max 100), `?search=` (name, code, description), `?is_active=true|false`, newest first, `meta` envelope.

| Method | Path | Body / filters | Notes |
|---|---|---|---|
| GET | `/catalogs/achievements` | filters above | Every achievement, active or not |
| POST | `/catalogs/achievements` | `{ code, name, description, icon, points?, condition: { type: 'matches_played' \| 'wins', count }, is_active? }` | 201. 409 `CODE_ALREADY_EXISTS` |
| GET | `/catalogs/achievements/:id` | | 404 `NOT_FOUND`; `usage: { owners_count }` |
| PATCH | `/catalogs/achievements/:id` | any of `name, description, icon, points, condition` | `code` immutable |
| POST | `/catalogs/achievements/:id/activate`, `/deactivate` | none | Idempotent |
| GET | `/catalogs/challenges` | filters above + `cadence`, `action_type` | |
| POST | `/catalogs/challenges` | `{ code, name, description, cadence: 'daily' \| 'weekly' \| 'monthly' \| 'one_time', action_type: 'play_matches' \| 'win_matches', target_count (1..10000), reward_xp? (0..100000), reward_currency? (0..1000000), is_active? }` | 201. 409 `CODE_ALREADY_EXISTS` |
| GET | `/catalogs/challenges/:id` | | `usage: { assignments_count, active_assignments_count }` |
| PATCH | `/catalogs/challenges/:id` | any of `name, description, cadence, action_type, target_count, reward_xp, reward_currency` | 409 `CATALOG_FIELD_LOCKED` (`details: { fields, usage }`) when `cadence`/`action_type` change after players were assigned it |
| POST | `/catalogs/challenges/:id/activate`, `/deactivate` | none | Idempotent |
| GET | `/catalogs/cosmetics` | filters above + `type` | |
| POST | `/catalogs/cosmetics` | `{ code, name, description, type: 'palette_skin' \| 'avatar' \| 'emblem', image_url (https), price_currency (0..1000000), is_active? }` | 201. 409 `CODE_ALREADY_EXISTS` |
| GET | `/catalogs/cosmetics/:id` | | `usage: { owners_count }` |
| PATCH | `/catalogs/cosmetics/:id` | any of `name, description, type, image_url, price_currency` | 409 `CATALOG_FIELD_LOCKED` when `type` changes after someone owns it |
| POST | `/catalogs/cosmetics/:id/activate`, `/deactivate` | none | Idempotent |
| POST | `/catalogs/assets` | multipart, field `file`: png, jpg or webp (checked by magic bytes), max 2 MB | 201 `{ url, path, content_type, size_bytes }`; `url` is the public URL in the `catalog-assets` bucket, to be used as `image_url` / `icon`. 400 for another type, a spoofed type, too large or no file. Audited (`catalog.asset_uploaded`) |

## invitations — `/api/v1/invitations` (`team.router.ts`, card #72)

| Method | Path | Auth | Purpose | Handler |
|---|---|---|---|---|
| GET | `/api/v1/invitations/preview?token=` | none (rate limit 30/min per IP) | Context for the panel's register/login page. 200 `{ club_name, role: 'admin' \| 'staff', email_hint (e.g. `m***@gmail.com`), expired }`; `Cache-Control: no-store`. Unknown, revoked and accepted tokens all answer 404 `INVITATION_INVALID` | `previewInvitation` (`team.controller.ts`) |

## Unmounted routers

Not imported by `src/index.ts`, so none of their routes exist:

- Empty stubs with only a `TODO`: `clubs/clubs.router.ts`, `matches/matches.router.ts`, `reservations/reservations.router.ts`, `tournaments/tournaments.router.ts`, `users/users.router.ts`.
- The dead `src/app.ts` imports those stubs, but it is not the entry point (`npm run dev` and `npm start` run `src/index.ts` / `dist/index.js`).

## Known gaps

Verified by reading the code (`src/index.ts`, the routers and `match-padel-web`):

- **Club management is partial (cards #66 F0, #67 F1).** Clubs can be created, activated and edited through `/platform` and `/club-admin`, an owner can register a club and submit it for review (`/me/clubs`, `/club-admin/:clubId/submit`), and courts (name, surface, price) can be managed there. Applications are reviewed through `/platform/applications` (card #68) and every status change emails the owner; club team management is built (card #72, `/club-admin/:clubId/team`, invitations); card #71 added the calendar, move/cancel and blocks; the admin app (`match-padel-web/apps/admin`) keeps reading some tables directly with the Supabase client until it is migrated to these endpoints.
- **Superadmin has no UI to grant roles.** Platform roles are granted by inserting into `platform_staff` (see `docs/permissions.md`).
- **No Socket.io server and no chat endpoints.** `src/lib/socket.ts` is a no-op and socket.io is not in `package.json`, although `docs/api-patterns.md` lists `match:*`, `staff:*` and `chat:message` events (`match_chats` exists in `docs/schema.sql`).
- Every call the player app makes today through `match-padel-web/apps/app` (`/auth/*`, `/clubs*`, `/courts/:id/slots`, `/reservations*`, `/payments/preference`, `/matches*`, `/users*`, `/tournaments*`, `/notifications*`) has a matching mounted route.

## Domain file inventory

Files present in `src/domains/<domain>/` (entity files use the singular name, e.g. `match.router.ts`). "yes" = exists and is used; "unused" = exists but nothing imports it.

| Domain | Mounted at | router | controller | service | repository | validator |
|---|---|---|---|---|---|---|
| auth | `/api/v1/auth` | yes | yes (holds logic and Supabase queries) | unused | unused | unused (`auth.validator.ts`; the controller defines its own schemas) |
| users | `/api/v1/users` | yes | yes | no | yes | no |
| clubs | `/api/v1/clubs` | yes | yes | no | yes | no (schema inline in the controller) |
| courts | `/api/v1/courts` | yes | no (reuses `reservation.controller.ts`) | yes (`schedule.service.ts`, pure: effective schedule and prices, card #70) | yes (`court.repository.ts`, loads the schedule context) | no |
| reservations | `/api/v1/reservations` | yes | yes | yes | yes | yes |
| matches | `/api/v1/matches` | yes | yes | yes | yes | no |
| tournaments | `/api/v1/tournaments` | yes | yes | yes | yes | no (schemas inline in the controller) |
| notifications | `/api/v1/notifications` | yes | yes | yes | yes | no |
| payments | `/api/v1/payments` | yes | yes | yes (holds Supabase queries) | no | no (schema inline in the controller) |
| achievements | `/api/v1/achievements` | yes | yes | yes | yes | no |
| access | `/api/v1/me` | yes | yes (`POST /me/clubs` reuses `club-admin.controller`) | yes | yes | no |
| club-admin | `/api/v1/club-admin/:clubId` | yes | yes | yes | yes | yes |
| platform | `/api/v1/platform` | yes | yes | yes | yes | yes |
| team | `/api/v1/club-admin/:clubId/team`, `/api/v1/invitations`, `POST /api/v1/me/invitations/accept` | yes (`invitationsRouter` is the public one) | yes | yes | yes | yes |
| audit | not mounted (used by the services) | no | no | yes (`recordAudit`) | yes | no |

No domain has a `__tests__/` folder.
