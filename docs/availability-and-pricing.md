# Availability and pricing — match-padel-api

Introduced by card #70 (`[Admin F2]`). Code: `src/domains/courts/schedule.service.ts` (pure resolution, no database) and
`src/domains/courts/court.repository.ts` (loads the data). Scope: `match-padel-web/docs/club-platform-scope.md`, section 4.

## Conventions

- **Timezone**: club-local, `America/Argentina/Buenos_Aires` (UTC-3, no DST), a fixed offset like the rest of the API
  (`clubDayBounds`). Dates are `YYYY-MM-DD`, times `HH:MM`, both club-local. API instants (`start_time`, `end_time`) are UTC ISO.
- **`day_of_week`**: 0 = Sunday ... 6 = Saturday (the existing column, JavaScript's `getUTCDay()`).
- **Midnight**: `close_time = '24:00'` (a Postgres `time` accepts it). A club open past midnight uses two intervals: day D until
  `24:00` and day D+1 from `00:00`. A reservation may cross midnight if both days' slots are contiguous.
- **Slot length**: `slot_minutes` in 30, 60, 90, 120 (default 60) per interval. Slots start at the interval's `open_time` and
  step by `slot_minutes`; a trailing partial slot is dropped (08:00-22:00 at 90 min gives 9 slots, the last ends 21:30, as it always did).

## Tables

| Table | Meaning |
|---|---|
| `court_schedules` | Weekly intervals of a court: `(court_id, day_of_week, open_time, close_time, slot_minutes, is_active)`, unique `(court_id, day_of_week, open_time)`. Several intervals per day. |
| `court_schedule_exceptions` | One row per `(court or club, date)`: `closed` or an alternative window (`open_time`, `close_time`, optional `slot_minutes`), with a `reason`. `court_id` null = the whole club. |
| `court_price_rules` | `(court_id, name, days_of_week[], start_time, end_time, price_per_hour, priority, is_active)`. |
| `courts.price_per_hour` | Base price: the fallback when no rule covers a slot. |
| `clubs.settings.opening_hours` | Onboarding draft `{ mon: [{open, close}], ... }`: the fallback of courts with no rows. |

## Resolution order (hours)

For a court and a club-local date:

1. **Exception for that date.** The court's own exception beats the club's. `closed` means no slots (and
   reservations get 409 `COURT_CLOSED`). An open window replaces the weekly hours of that day; its slot length is
   `slot_minutes`, else the weekly row's, else 60. An exception of another court never applies.
2. **The court's weekly rows** (`court_schedules`, active). If the court has any rows, a day with no row is closed.
3. **The club's `opening_hours`** when the court has no rows at all (60 minute slots).
4. Nothing: no slots (a court with no schedule anywhere is not bookable, as before).

`PUT /club-admin/:clubId/courts/:courtId/schedule` with an empty list therefore means "use the club hours again"; to stop
a court from being offered, deactivate it (`is_active: false`).

## Resolution order (price)

For each slot, the **hourly rate** is the matching `court_price_rules` row, else `courts.price_per_hour`:

1. Rules that are active, list the slot's day of week and cover the **slot start** (`start_time <= start < end_time`).
   A slot that straddles a band boundary is priced by its start (a 16:30-18:00 slot with a band from 17:00 uses the earlier rate).
2. Highest `priority` wins; ties go to the narrower time window, then to the rule with fewer days, then to the lowest id.
   `PUT .../price-rules` rejects (400) active rules that share a day, overlap and have the same priority, so ties
   should not exist in stored data.
3. The slot's **price** is `rate x slot_minutes / 60`, computed in cents and rounded to 2 decimals (half up).

## Where it is used

| Flow | What changed |
|---|---|
| `GET /courts/:courtId/slots?date=` | Slots come from the effective schedule and carry `price_per_hour` and `price`. A date closed by an exception returns `[]`. |
| `GET /clubs/:clubId/availability?date=` | Same slots per court; each court entry has `price_per_hour` and `price`; the slot has `min_price` (lowest hourly rate, unchanged meaning) and `min_total_price`. |
| `POST /reservations` | The requested range must be whole, contiguous slots of the effective schedule (several slots allowed: the total is the sum of the slot prices), else 409 `OUTSIDE_SCHEDULE` / `COURT_CLOSED`. `total_price` is computed here, never taken from the client. |
| `POST /matches` | Same check and pricing for the reservation it creates (the 4-way split is unchanged). |
| Expiry, cancellation, payments | Untouched. A stored `court_reservations.total_price` is never recomputed: changing rules or exceptions does not rewrite existing reservations, which stay valid (closing a day only returns a `warning` count). |

## Blocks (card #71)

A block is a time range on one court that players cannot book (maintenance, classes, private events). Simple blocks,
no recurrence. Table `court_blocks(id, club_id, court_id, start_time, end_time, reason, created_by, created_at)`,
`end_time > start_time`; one row per court, so a block over several courts is several rows created in one transaction
by the RPC `create_court_blocks`. Blocks of the same court never overlap (exclusion constraint). Times are UTC instants.

| Where | Effect |
|---|---|
| `GET /courts/:courtId/slots`, `GET /clubs/:clubId/availability` | A slot overlapping a block has `available: false` and `unavailable_reason: 'blocked'` (the club availability simply leaves that court out of the slot). The block's reason is never shown to players. |
| `POST /reservations`, `POST /matches` | 409 `COURT_BLOCKED` when the range overlaps a block. A database trigger on `court_reservations` backs it up for the race between a booking and a new block. |
| `PATCH .../reservations/:id/move` | 409 `COURT_BLOCKED` when the target overlaps a block. |
| `POST /club-admin/:clubId/blocks` | Blocks never cover existing pending/confirmed reservations: any conflict (reservation or block, on any of the courts) rejects the whole request with 409 `BLOCK_CONFLICTS` and `details.conflicts`; the club must move or cancel them first. Nothing is cancelled automatically. |

Blocks sit next to the schedule and exceptions: closed time from a schedule exception is a different concept (it is
about the day's hours and does not touch existing reservations), and a block is about a concrete range. The calendar
returns both, so the panel can draw them differently.

## Club-initiated move and cancel (card #71)

- **Move** keeps the price as it was charged (never recomputed, even if the target slot costs more or less) and the
  status; the new time must have the same duration. It must be whole slots of the target court's effective schedule, in
  the future, with no other reservation and no block. A match on the reservation needs no change: it references the
  reservation, which moved with its players. Booker and match players are notified in-app.
- **Cancel** always refunds 100% of every approved payment (MercadoPago refund per payment, `refundPayment`) whatever
  the time left, and never applies the late-cancellation currency rule: the club's decision does not penalize the
  player. The per-club refund policy is a later card (F3). A reservation of a match cancels the match too
  (`matchService.cancelByClub`: refunds all payers, sets the match `cancelled`), so no match stays on a cancelled
  reservation. Pending (unpaid) payment rows are left as they are; a player who still pays an old checkout link after
  the cancellation is the same pre-existing gap as with the expiry job (the payment would need a manual refund).
- No email: the mail module is built around club-owner application notices and has no player recipient resolution, so
  the player is told in-app only (target — not implemented yet).

## Rollout and compatibility

Card #71's migration is also additive (a new table, an RPC and a trigger that only fires when a block exists); production on the previous API ignores blocks, and none can exist before the new API is released.

The card #70 migration is additive; existing courts keep their rows (seed: every day 08:00-22:00, 90 min) and therefore the same
slots and prices. Courts with no rows whose club has `opening_hours` get rows from them (60 min). Production keeps running
the previous API until release: it reads `court_schedules` with `.single()` per court and day, so it is only safe while a
court has one interval per day; clubs can only create more once the new API and panel are released.
