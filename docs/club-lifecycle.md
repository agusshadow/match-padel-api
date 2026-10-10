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
| `rejected` | Refusal, with a reason | No | **No** (409) | `draft` (superadmin re-opens it) |
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
| `pending` to `approved` | Reviewer or superadmin | `POST /platform/applications/:clubId/approve` | card #68 |
| `pending` to `changes_requested` | Reviewer or superadmin (note required) | `POST /platform/applications/:clubId/request-changes` | card #68 |
| `pending` to `rejected` | Reviewer or superadmin (reason required) | `POST /platform/applications/:clubId/reject` | card #68 |
| `rejected` to `draft` | Superadmin | `POST /platform/clubs/:clubId/reopen` | card #68 |
| `approved` to `suspended` | Superadmin (reason required) | `POST /platform/clubs/:clubId/suspend` | card #68 |
| `suspended` to `approved` | Superadmin | `POST /platform/clubs/:clubId/unsuspend` | card #68 |

Every transition above is reachable. Each one: checks the current status (409 `CONFLICT` otherwise), updates with a
compare-and-set on the expected status (a concurrent review gets 409 instead of overwriting), writes
`club_status_history` (actor, from, to, note), calls `recordAudit` and fires the email, in that order.

**Rejection is not final.** A rejection can come from a fixable cause (a wrong document, a typo in the tax id), and
without a way back the owner would have to abandon the club and register a new one. A superadmin can re-open it to
`draft` (reviewers cannot, so a reviewer's refusal is only overturned by a higher role); the owner then edits and
submits again, and the history keeps `rejected` to `draft` to `pending`. `rejected` clubs stay read-only until then.

The history of a club that goes back and forth reads, oldest first: `null` to `draft`, `draft` to `pending`,
`pending` to `changes_requested` (reviewer note), `changes_requested` to `pending`, `pending` to `approved`.

## Reviewer scope

A reviewer only sees clubs in `pending` and `changes_requested` (inbox, detail, documents, `GET /platform/clubs`).
Anything else is hidden: a club outside the scope answers 404, a status filter outside it answers 403.
A superadmin sees every status.

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
| `schedule` | `opening_hours` with at least one day with an interval, **or** (card #70) at least one active court with its own weekly schedule (`PUT /courts/:courtId/schedule`) |
| `documents` | at least one document |

`opening_hours` is a weekly **draft** stored in `clubs.settings.opening_hours`. Since card #70 the per-court schedule
(`court_schedules`) is the real model and `opening_hours` is only the fallback of courts that have no rows of their own;
the step is complete with either. Editing schedules, exceptions and prices follows the same status rules as courts
(editable in `draft`, `changes_requested` and `approved`; 409 otherwise). See `docs/availability-and-pricing.md`.

## Documents

Private bucket `club-documents` (10 MB, PDF/JPEG/PNG/WebP), key `<clubId>/<uuid>-<safe filename>`. Only the API writes;
files are read through 10-minute signed URLs for the club owner/admin, reviewers and superadmins.

## Emails

Every status change that has a template emails the club owner(s) through `notifyApplicationStatusChange`
(`src/domains/mail/mail.service.ts`, see `docs/email.md`) after the transition succeeded: `submit` (`pending`),
the review actions (`approved`, `rejected` with the reason, `changes_requested` with the reviewer notes), `suspend`
(`suspended`, reason) and `unsuspend` (`reinstated`). `reopen` (`draft`) sends nothing. It never throws.

## Notes for the release

The migration is additive. Between applying it to production and releasing this code, a club created with the old
`POST /platform/clubs` gets the column default (`draft`); the old API does not filter by status, so it still shows it,
and the new API creates it as `approved`.
