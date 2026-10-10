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
- A **reviewer** has no club access of its own. Since card #67 it can list clubs in every status and get the signed URL of an application document; the review actions arrive with the next card.

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
| Confirm / cancel / complete a reservation | `PATCH /reservations/:id` | Y | Y | Y | - | Y |
| List matches | `GET /matches` | Y | Y | - | - | Y |
| List tournaments | `GET /tournaments` | Y | Y | - | - | Y |
| Read club data | `GET /` | Y | Y | Y | - | Y |
| Edit club data (draft, changes_requested, approved only) | `PATCH /` | Y | Y | - | - | Y |
| Onboarding status, steps, history | `GET /onboarding` | Y | Y | - | - | Y |
| Submit the application | `POST /submit` | Y | - | - | - | Y |
| List / create / edit / delete courts | `GET`, `POST /courts`, `PATCH`, `DELETE /courts/:id` | Y | Y | - | - | Y |
| Upload / delete / get URL of a document | `POST /documents`, `DELETE /documents/:id`, `GET /documents/:id/url` | Y | Y | - | - | Y |

A caller with no membership in `:clubId` (including an owner of a different club) gets `403 FORBIDDEN`; a malformed id is `400`.

### Platform — `/api/v1/platform`

| Action | Endpoint | Reviewer | Superadmin |
|---|---|---|---|
| Global summary | `GET /summary` | - | Y |
| List clubs (every status, `status` filter) | `GET /clubs` | Y | Y |
| Create a club (born `approved`) | `POST /clubs` | - | Y |
| Signed URL of an application document | `GET /clubs/:clubId/documents/:id/url` | Y | Y |
| Activate / deactivate a club | `PATCH /clubs/:id/active` | - | Y |
| List users | `GET /users` | - | Y |
| Audit log | `GET /audit-log` | - | Y |

### Any signed-in user

`GET /api/v1/me/access` returns the caller's platform role and the clubs they can administer (each with its `status`).

`POST /api/v1/me/clubs` creates a club application in `draft`; the caller becomes its `owner`. The club panel registers a
new owner with `POST /auth/register`, then `POST /me/clubs`. Only the owner of the club (or a superadmin) can submit it.

## Audit

Every write above calls `recordAudit` (`src/domains/audit/audit.service.ts`) after it succeeds: actor, club, `action`
(`club.created`, `club.updated`, `club.activated`, `club.deactivated`, `reservation.status_changed`), entity and a
`metadata` payload with the change. Card #67 adds `club.submitted`, `court.created`, `court.updated`, `court.deleted`, `club.document_uploaded` and `club.document_deleted` (and `club.created` also comes from `POST /me/clubs`). A failure to write the audit entry is logged and never fails the operation.
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
