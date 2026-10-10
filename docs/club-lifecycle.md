# Club lifecycle — match-padel-api

Introduced by card #67 (`[Admin F1]`). Scope reference: `match-padel-web/docs/club-platform-scope.md`, section 3.

`clubs.status` is the enum `club_status`. Existing clubs were backfilled to `approved`; a new row defaults to `draft`.
Every change is written to `club_status_history` (club, actor, from, to, note) and to `audit_log`.

## States

| State | Meaning | Visible to players | Owner/admin can edit data, courts, documents | Next states |
|---|---|---|---|---|
| `draft` | The owner is filling the application | No | Yes | `pending` |
| `pending` | Submitted, waiting for a reviewer | No | **No** (409) | `approved`, `rejected`, `changes_requested` |
| `changes_requested` | A reviewer asked for corrections | No | Yes | `pending` |
| `approved` | Live | Yes (while `is_active`) | Yes | `suspended` |
| `rejected` | Final refusal, with a reason | No | **No** (409) | none |
| `suspended` | Taken down by the platform | No | **No** (409) | `approved` |

"Visible to players" means every public read (`/clubs`, `/courts/:id/slots`, reservations and matches creation,
tournaments list and detail) and the anon-key RLS read of `clubs` and `courts`. Staff of the club and platform staff
always read their club, whatever its state (`GET /me/access`, `/club-admin/:clubId`, `/platform/clubs`).

## Who can transition

| Transition | Who | Where | Built |
|---|---|---|---|
| (none) to `draft` | Any signed-in user, becomes owner | `POST /me/clubs` | card #67 |
| (none) to `approved` | Superadmin | `POST /platform/clubs` | card #66, status since #67 |
| `draft` / `changes_requested` to `pending` | Club owner (or superadmin) | `POST /club-admin/:clubId/submit` | card #67 |
| `pending` to `approved` / `rejected` / `changes_requested` | Reviewer or superadmin | review endpoints | next card |
| `approved` to `suspended` and back | Superadmin | platform endpoint | next card |

`PATCH /platform/clubs/:id/active` (superadmin) is independent of the status: an approved club that is not active is
also hidden.

## Application completeness (submit)

`POST /submit` and `GET /onboarding` use the same rules. A step is complete when:

| Step | Requires |
|---|---|
| `club` | `name`, `legal_name`, `tax_id` |
| `location` | `address`, `city`, `lat` and `lng` |
| `contact` | `phone`, `email` |
| `courts` | at least one active court with `price_per_hour > 0` |
| `schedule` | `opening_hours` with at least one day with an interval |
| `documents` | at least one document |

`opening_hours` is a weekly **draft** stored in `clubs.settings.opening_hours`; F2 replaces it with the per-court
schedule model (`court_schedules` already exists and is what slot generation reads).

## Documents

Private bucket `club-documents` (10 MB, PDF/JPEG/PNG/WebP), key `<clubId>/<uuid>-<safe filename>`. Only the API writes;
files are read through 10-minute signed URLs for the club owner/admin, reviewers and superadmins.

## Notes for the release

The migration is additive. Between applying it to production and releasing this code, a club created with the old
`POST /platform/clubs` gets the column default (`draft`); the old API does not filter by status, so it still shows it,
and the new API creates it as `approved`.
