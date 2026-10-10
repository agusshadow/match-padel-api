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

## Rollout and compatibility

The migration is additive; existing courts keep their rows (seed: every day 08:00-22:00, 90 min) and therefore the same
slots and prices. Courts with no rows whose club has `opening_hours` get rows from them (60 min). Production keeps running
the previous API until release: it reads `court_schedules` with `.single()` per court and day, so it is only safe while a
court has one interval per day; clubs can only create more once the new API and panel are released.
