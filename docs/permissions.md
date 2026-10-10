# Permissions — match-padel-api

Introduced by card #66 (`[Admin F0]`). The API (service_role, bypasses RLS) authorizes every
request itself; RLS only protects reads made straight from the browser with a user's token.
Scope reference: `match-padel-web/docs/club-platform-scope.md`.

## Roles and where they live

| Level | Role (UI name) | Stored as | Table |
|---|---|---|---|
| Platform | Superadmin | `superadmin` | `platform_staff.role` (enum `platform_role`) |
| Platform | Reviewer | `reviewer` | `platform_staff.role` |
| Club | Dueño (owner) | `owner` | `club_staff.role` (enum `staff_role`) |
| Club | Administrador | `admin` | `club_staff.role` |
| Club | Recepción | `staff` | `club_staff.role` |
| Player | Player | `player` | `users.role` (`user_role`) |

- `staff_role` was **not** renamed (renames are destructive): `owner`, `admin`, `staff` map to Dueño, Administrador, Recepción.
- Club membership is per club (`club_staff` has `unique(club_id, user_id)`): one person can be owner of several clubs and staff of another.
- `users.role` is kept because the player app still reads it. The new routes ignore it: platform roles come only from `platform_staff` and club roles only from `club_staff`.
- A platform **superadmin acts as `superadmin` in every club** (`requireClubRole` always passes, `GET /me/access` lists every club with role `superadmin`).
- A **reviewer** has no club access of its own. Since card #68 it works only on clubs in `pending` and `changes_requested`: it lists them, reads their detail and documents, and approves, rejects or asks for changes. It never sees approved, rejected or suspended clubs, nor commissions or catalogs (a club outside its scope is 404, a status filter outside its scope is 403).

## How to grant a superadmin

There is no endpoint or UI for it on purpose. Run, in the right Supabase project (dev: `vrnonxpxksaruvsvbplt`, production: `ebdnlrwzhthqflsbdzvu`, only by the human or an explicitly directed session):

```sql
insert into platform_staff (user_id, role)
values ('<users.id of the person>', 'superadmin')
on conflict (user_id) do update set role = excluded.role;
```

The migration backfills every `users.role = 'super_admin'` as `superadmin`. A club owner is created with
`POST /api/v1/platform/clubs` (`ownerUserId`) or by inserting into `club_staff` (`role = 'owner'`).

## Matrix

`Y` = allowed, `-` = 403 (or no route). Superadmin column applies to every club.

### Club panel — `/api/v1/club-admin/:clubId`

| Action | Endpoint | Owner | Admin | Reception | Reviewer | Superadmin |
|---|---|---|---|---|---|---|
| Club summary | `GET /summary` | Y | Y | Y | - | Y |
| List reservations | `GET /reservations` | Y | Y | Y | - | Y |
| Confirm / complete a reservation (card #72: not Reception) | `PATCH /reservations/:id` with `confirmed` / `completed` | Y | Y | - | - | Y |
| Cancel a reservation | `PATCH /reservations/:id` with `cancelled` | Y | Y | Y | - | Y |
| Calendar (reservations, ranked matches, blocks, open hours) (card #71) | `GET /calendar` | Y | Y | Y | - | Y |
| Move / cancel an existing reservation (card #71). Reception never creates reservations | `PATCH /reservations/:id/move`, `POST /reservations/:id/cancel` | Y | Y | Y | - | Y |
| List blocks (card #71) | `GET /blocks` | Y | Y | Y | - | Y |
| Create / delete blocks (card #71) | `POST /blocks`, `DELETE /blocks/:id` | Y | Y | - | - | Y |
| List matches | `GET /matches` | Y | Y | - | - | Y |
| List tournaments | `GET /tournaments` | Y | Y | - | - | Y |
| Read club data | `GET /` | Y | Y | Y | - | Y |
| Edit club data (draft, changes_requested, approved only) | `PATCH /` | Y | Y | - | - | Y |
| Onboarding status, steps, history | `GET /onboarding` | Y | Y | - | - | Y |
| Submit the application | `POST /submit` | Y | - | - | - | Y |
| List / create / edit / delete courts | `GET`, `POST /courts`, `PATCH`, `DELETE /courts/:id` | Y | Y | - | - | Y |
| Read a court's schedule, price rules, exceptions and day preview (card #70) | `GET /courts/:courtId/schedule`, `/price-rules`, `/preview`, `GET /schedule-exceptions` | Y | Y | Y | - | Y |
| Replace a court's schedule or price rules, create / delete exceptions (card #70) | `PUT /courts/:courtId/schedule`, `PUT /courts/:courtId/price-rules`, `POST`, `DELETE /schedule-exceptions` | Y | Y | - | - | Y |
| Upload / delete / get URL of a document | `POST /documents`, `DELETE /documents/:id`, `GET /documents/:id/url` | Y | Y | - | - | Y |
| See the team (members and open invitations) (card #72) | `GET /team` | Y | Y | - | - | Y |
| Invite, resend, revoke an invitation; change a member's role; remove a member (card #72) | `POST /team/invitations`, `POST /team/invitations/:id/resend`, `DELETE /team/invitations/:id`, `PATCH`, `DELETE /team/members/:userId` | Y | - | - | - | Y |
| Mercado Pago account of the club (not built yet; target) | - | Y | - | - | - | Y |

Reception (`staff`) only sees, moves and cancels existing reservations (calendar, list, move, cancel) and reads schedules, prices and blocks: it never creates reservations, changes prices or schedules, confirms/completes reservations, or touches the team. The Administrador manages courts, schedules, prices, calendar, reservations, blocks and tournaments but not the team nor (future) the Mercado Pago account; both are owner-only. The team routes enforce this with `requireClubRole(['owner'])` for writes and `['owner', 'admin']` for the read. Every route in `club-admin.router.ts` was checked against this table in card #72; the only deviation found (Reception could confirm/complete reservations through `PATCH /reservations/:id`) is fixed in `updateReservationStatus`.

A caller with no membership in `:clubId` (including an owner of a different club) gets `403 FORBIDDEN`; a malformed id is `400`.

### Platform — `/api/v1/platform`

| Action | Endpoint | Reviewer | Superadmin |
|---|---|---|---|
| Global summary | `GET /summary` | - | Y |
| List clubs (superadmin: every status; reviewer: only `pending`/`changes_requested`) | `GET /clubs` | Y (scoped) | Y |
| Applications inbox | `GET /applications` | Y (scoped) | Y |
| Application detail with documents and history | `GET /applications/:clubId` | Y (scoped) | Y |
| Approve / request changes / reject an application | `POST /applications/:clubId/approve`, `/request-changes`, `/reject` | Y (scoped) | Y |
| Re-open a rejected application | `POST /clubs/:clubId/reopen` | - | Y |
| Suspend / reinstate an approved club | `POST /clubs/:clubId/suspend`, `/unsuspend` | - | Y |
| Create a club (born `approved`) | `POST /clubs` | - | Y |
| Signed URL of an application document | `GET /clubs/:clubId/documents/:id/url` | Y (scoped) | Y |
| Activate / deactivate a club | `PATCH /clubs/:id/active` | - | Y |
| List users | `GET /users` | - | Y |
| Audit log | `GET /audit-log` | - | Y |
| Gamification catalogs: list, read, create, edit, activate / deactivate achievements, challenges and cosmetics; upload catalog images (card #78) | `/catalogs/{achievements,challenges,cosmetics}[/:id[/activate\|/deactivate]]`, `POST /catalogs/assets` | - | Y |

### Any signed-in user

`POST /api/v1/me/invitations/accept` (card #72) joins the club of an invitation with the invited role, only if the caller's confirmed email equals the invited email. `GET /api/v1/invitations/preview?token=` is public (rate limited) and reveals only club name, role, a masked email and `expired`.

`GET /api/v1/me/access` returns the caller's platform role and the clubs they can administer (each with its `status`).

`POST /api/v1/me/clubs` creates a club application in `draft`; the caller becomes its `owner`. The club panel registers a
new owner with `POST /auth/register`, then `POST /me/clubs`. Only the owner of the club (or a superadmin) can submit it.

## Audit

Every write above calls `recordAudit` (`src/domains/audit/audit.service.ts`) after it succeeds: actor, club, `action`
(`club.created`, `club.updated`, `club.activated`, `club.deactivated`, `reservation.status_changed`), entity and a
`metadata` payload with the change. Card #68 adds `club.approved`, `club.changes_requested`, `club.rejected`, `club.reopened`, `club.suspended` and `club.unsuspended` (metadata `{ from, to, note }`). Card #67 adds `club.submitted`, `court.created`, `court.updated`, `court.deleted`, `club.document_uploaded` and `club.document_deleted` (and `club.created` also comes from `POST /me/clubs`). Card #70 adds `court.schedule_replaced`, `court.price_rules_replaced`, `schedule_exception.created` and `schedule_exception.deleted`. Card #71 adds `reservation.moved` (`from`/`to` court and times), `reservation.cancelled_by_club` (`from`, `to`, `reason`, `via`, `match_id`, `refund`; also written when the status PATCH cancels), `court_block.created` and `court_block.deleted`. Card #78 adds `catalog.{achievement,challenge,cosmetic}_{created,updated,activated,deactivated}` (entity `achievement` / `challenge` / `cosmetic`; metadata `{ code, before, after }`) and `catalog.asset_uploaded`. Card #72 adds `team.invitation_created`, `team.invitation_resent`, `team.invitation_revoked`, `team.invitation_accepted` (entity `club_invitation`, `before`/`after` status and role; never the token) and `team.member_role_changed`, `team.member_removed` (entity `club_staff`, `before`/`after` role, `user_id`). A failure to write the audit entry is logged and never fails the operation.
`audit_log` has RLS enabled with no policies, so only the API can read or write it.

## Database side (RLS)

Staff reads from the browser are per club: the policies on `court_reservations`, `matches`, `match_players` and
`tournaments` use the `security definer` helpers `is_club_member(club_id)`, `is_court_club_member(court_id)` and
`is_match_club_member(match_id)` (membership in `club_staff`, or `is_platform_superadmin()`), executable by
`authenticated` only. Players keep reading their own rows. Writes from the client remain closed (card #65).

Card #67 (migration `20261010150929_admin_club_onboarding`): the public read policy of `clubs` is now
`status = 'approved' and is_active` for `anon` and `authenticated`, and a second policy `clubs_staff_read` lets
members of the club (`is_club_member`) and any platform staff (`is_platform_staff`) read every state. `courts` follows
the same split (public only for courts of a public club). `club_status_history` and `club_documents` have RLS enabled and
no policies (API only); the `club-documents` bucket is private. See `docs/club-lifecycle.md`.

Card #70 (migration `20261010153252_court_schedules_exceptions_price_rules`): `court_schedules`, `court_schedule_exceptions`
and `court_price_rules` have RLS enabled. Members of the club (`is_club_member` / `is_court_club_member`) and platform staff
read; nobody writes from the client; players read prices and slots only through the public availability endpoints (service
role). The old public read policy of `court_schedules` was removed (the API never used it). The RPCs
`replace_court_schedule` / `replace_court_price_rules` are executable by `service_role` only.

Card #71 (migration `20261010154511_court_blocks`): `court_blocks` has RLS enabled; members of the club
(`is_club_member`) and platform staff read, nobody writes from the client (grants: `select` to `authenticated` only).
Players never read it: availability goes through the public endpoints (service role). `create_court_blocks` is
executable by `service_role` only. The trigger function `court_reservations_check_blocks` is `security definer` (it must
see every block whatever the caller's RLS) and is not executable by `anon`/`authenticated`.

Card #72 (migration `20261010155448_club_team_invitations`): `club_invitations` has RLS enabled, no policies and no
client grants (API only, service role). It stores only a SHA-256 hash of the token. `accept_club_invitation` is
executable by `service_role` only and is not `security definer`.

Card #78 (migration `20261010160513_gamification_catalogs`): `achievements`, `challenges` and `cosmetics` keep their public
read policies (active rows; achievements all rows) and gain `challenges_participant_read` / `cosmetics_owner_read`, which
let an authenticated player read the inactive item they have progress on / own. Nobody writes the catalogs from the
client. The `catalog-assets` bucket is public for reads; there is no write policy, only the API (service role) uploads.
