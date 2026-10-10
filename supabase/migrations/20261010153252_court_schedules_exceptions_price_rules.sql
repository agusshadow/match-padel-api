-- Card #70 [Admin F2]: weekly schedules per court, schedule exceptions and
-- price rules by time band and day.
--
-- Additive and backward compatible. `court_schedules` already exists and is
-- what the code in production reads (one row per court and day, `.single()`):
-- it is extended, not replaced, and existing rows keep their exact meaning.
-- The two new tables are only read by the new API. The only tightening is the
-- public read policy of `court_schedules` (see the end), which nothing in
-- production uses: the API reads with the service role.
--
-- Conventions
--   day_of_week : 0 = Sunday ... 6 = Saturday (same as the existing column and
--                 as JavaScript's Date.getUTCDay()).
--   times       : club-local wall-clock time (America/Argentina/Buenos_Aires,
--                 UTC-3, no DST). `time` accepts '24:00', which is the
--                 convention for "closes at midnight": close_time = '24:00'.
--                 A club open past midnight uses two rows (day D until 24:00
--                 and day D+1 from 00:00).
--   price rule  : covers a slot when the slot's start time is in
--                 [start_time, end_time) on one of its days_of_week.

-- ---------------------------------------------------------------------------
-- court_schedules: weekly opening intervals per court
-- ---------------------------------------------------------------------------
alter table public.court_schedules alter column slot_minutes set default 60;

-- NOT VALID: enforced for every new or updated row; rows that already exist
-- are not re-checked (they are the seed's 08:00-22:00 / 90 min rows).
do $$ begin
  alter table public.court_schedules
    add constraint court_schedules_slot_minutes_check
    check (slot_minutes in (30, 60, 90, 120)) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.court_schedules
    add constraint court_schedules_time_range_check
    check (close_time > open_time) not valid;
exception when duplicate_object then null; end $$;

-- Several intervals per day are allowed (e.g. 08:00-13:00 and 16:00-24:00).
create unique index if not exists court_schedules_court_day_open_uidx
  on public.court_schedules (court_id, day_of_week, open_time);

-- ---------------------------------------------------------------------------
-- Composite key so an exception can prove its court belongs to its club.
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.courts add constraint courts_id_club_id_key unique (id, club_id);
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------------------------------------------------------------------------
-- court_schedule_exceptions: a date on which the club (court_id null) or one
-- court is closed or has different hours. One row per (court or club, date).
-- A court-level exception beats a club-level one.
-- ---------------------------------------------------------------------------
create table if not exists public.court_schedule_exceptions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  court_id      uuid,
  date          date not null,
  closed        boolean not null default true,
  open_time     time,
  close_time    time,
  slot_minutes  smallint check (slot_minutes is null or slot_minutes in (30, 60, 90, 120)),
  reason        text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint court_schedule_exceptions_court_fkey
    foreign key (court_id, club_id) references public.courts (id, club_id) on delete cascade,
  constraint court_schedule_exceptions_hours_check
    check (closed or (open_time is not null and close_time is not null and close_time > open_time))
);

create unique index if not exists court_schedule_exceptions_club_date_uidx
  on public.court_schedule_exceptions (club_id, date) where court_id is null;
create unique index if not exists court_schedule_exceptions_court_date_uidx
  on public.court_schedule_exceptions (court_id, date) where court_id is not null;
create index if not exists court_schedule_exceptions_club_date_idx
  on public.court_schedule_exceptions (club_id, date);
create index if not exists court_schedule_exceptions_created_by_idx
  on public.court_schedule_exceptions (created_by);

-- ---------------------------------------------------------------------------
-- court_price_rules: hourly price by day and time band. The rule with the
-- highest priority that covers the slot start wins; ties are broken by the
-- narrower time window, then fewer days (the API rejects same-priority rules
-- that overlap). With no matching rule the price is courts.price_per_hour.
-- ---------------------------------------------------------------------------
create table if not exists public.court_price_rules (
  id              uuid primary key default gen_random_uuid(),
  court_id        uuid not null references public.courts(id) on delete cascade,
  name            text not null,
  days_of_week    smallint[] not null,
  start_time      time not null,
  end_time        time not null,
  price_per_hour  numeric(10,2) not null check (price_per_hour > 0),
  priority        smallint not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint court_price_rules_days_check
    check (cardinality(days_of_week) > 0 and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint court_price_rules_time_range_check check (end_time > start_time)
);

create index if not exists court_price_rules_court_idx on public.court_price_rules (court_id);

-- ---------------------------------------------------------------------------
-- RLS: members of the club and platform staff read; nobody writes from the
-- client. Players never read these tables directly: the public availability
-- endpoints use the service role.
-- ---------------------------------------------------------------------------
alter table public.court_schedules enable row level security;
alter table public.court_schedule_exceptions enable row level security;
alter table public.court_price_rules enable row level security;

drop policy if exists "schedules_public_read" on public.court_schedules;
drop policy if exists "court_schedules_staff_read" on public.court_schedules;
create policy "court_schedules_staff_read" on public.court_schedules
  for select to authenticated
  using (public.is_court_club_member(court_id) or public.is_platform_staff());

drop policy if exists "court_schedule_exceptions_staff_read" on public.court_schedule_exceptions;
create policy "court_schedule_exceptions_staff_read" on public.court_schedule_exceptions
  for select to authenticated
  using (public.is_club_member(club_id) or public.is_platform_staff());

drop policy if exists "court_price_rules_staff_read" on public.court_price_rules;
create policy "court_price_rules_staff_read" on public.court_price_rules
  for select to authenticated
  using (public.is_court_club_member(court_id) or public.is_platform_staff());

revoke all on table public.court_schedule_exceptions from anon, authenticated;
revoke all on table public.court_price_rules from anon, authenticated;
grant select on table public.court_schedule_exceptions to authenticated;
grant select on table public.court_price_rules to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic "replace the whole set" used by the API (service_role only).
-- ---------------------------------------------------------------------------
create or replace function public.replace_court_schedule(p_court_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.court_schedules where court_id = p_court_id;
  insert into public.court_schedules (court_id, day_of_week, open_time, close_time, slot_minutes, is_active)
  select p_court_id, r.day_of_week, r.open_time, r.close_time, r.slot_minutes, true
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(day_of_week smallint, open_time time, close_time time, slot_minutes smallint);
end;
$$;

create or replace function public.replace_court_price_rules(p_court_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.court_price_rules where court_id = p_court_id;
  insert into public.court_price_rules
    (court_id, name, days_of_week, start_time, end_time, price_per_hour, priority, is_active)
  select p_court_id, r.name, r.days_of_week, r.start_time, r.end_time, r.price_per_hour,
         coalesce(r.priority, 0), coalesce(r.is_active, true)
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(name text, days_of_week smallint[], start_time time, end_time time,
         price_per_hour numeric, priority smallint, is_active boolean);
end;
$$;

revoke execute on function public.replace_court_schedule(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.replace_court_price_rules(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_court_schedule(uuid, jsonb) to service_role;
grant execute on function public.replace_court_price_rules(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Backfill: a court with no schedule rows inherits the weekly draft the club
-- stored in clubs.settings.opening_hours during onboarding (card #67). Courts
-- that already have rows (the seeded 08:00-22:00 / 90 min ones) are untouched,
-- and a court with neither keeps having no slots, exactly as today. Draft
-- intervals have no slot length: 60 minutes, the new default.
-- ---------------------------------------------------------------------------
with draft as (
  select
    c.id as court_id,
    case d.key
      when 'sun' then 0 when 'mon' then 1 when 'tue' then 2 when 'wed' then 3
      when 'thu' then 4 when 'fri' then 5 when 'sat' then 6
    end::smallint as day_of_week,
    case when (i.value->>'open') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         then (i.value->>'open')::time end as open_time,
    case when (i.value->>'close') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
         then (i.value->>'close')::time end as close_time
  from public.courts c
  join public.clubs cl on cl.id = c.club_id
  cross join lateral jsonb_each(
    case when jsonb_typeof(cl.settings->'opening_hours') = 'object'
         then cl.settings->'opening_hours' else '{}'::jsonb end
  ) as d(key, value)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end
  ) as i(value)
  where d.key in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
    and not exists (select 1 from public.court_schedules s where s.court_id = c.id)
)
insert into public.court_schedules (court_id, day_of_week, open_time, close_time, slot_minutes, is_active)
select distinct court_id, day_of_week, open_time, close_time, 60, true
from draft
where open_time is not null and close_time is not null and close_time > open_time
on conflict do nothing;
