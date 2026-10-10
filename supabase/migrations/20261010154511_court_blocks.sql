-- Card #71 [Admin F2]: court blocks (a date and time range on a court that
-- players cannot book: maintenance, classes, private events). Simple blocks,
-- no recurrence.
--
-- Additive and backward compatible: one new table, one RPC and one trigger.
-- The API in production does not know about blocks and keeps working (no block
-- rows can exist until the new API creates them). No enum is changed: the
-- notification types `reservation_cancelled` and `system` already exist.
--
-- Model
--   court_blocks : one row per court. A block over several courts is several
--                  rows created together by `create_court_blocks`.
--   Same-court blocks never overlap (exclusion constraint, which also serves
--   as the index for "blocks overlapping a range" queries).
--   A block never overlaps a pending/confirmed reservation: `create_court_blocks`
--   refuses to create it and returns the conflicts, and a trigger on
--   court_reservations refuses a reservation (insert, or move of court/time)
--   that overlaps a block. Both take the same per-court advisory lock, so the
--   two checks cannot race each other.

-- ---------------------------------------------------------------------------
-- court_blocks
-- ---------------------------------------------------------------------------
create table if not exists public.court_blocks (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  court_id    uuid not null,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  reason      text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- proves the court belongs to the club (courts_id_club_id_key, card #70)
  constraint court_blocks_court_fkey
    foreign key (court_id, club_id) references public.courts (id, club_id) on delete cascade,
  constraint court_blocks_range_check check (end_time > start_time),
  constraint court_blocks_no_overlap exclude using gist (
    court_id with =,
    tstzrange(start_time, end_time) with &&
  )
);

create index if not exists court_blocks_club_start_idx on public.court_blocks (club_id, start_time);
create index if not exists court_blocks_created_by_idx on public.court_blocks (created_by);

-- ---------------------------------------------------------------------------
-- RLS: members of the club and platform staff read; nobody writes from the
-- client (the API, with the service role, is the only writer). Players never
-- read this table: availability goes through the public endpoints.
-- ---------------------------------------------------------------------------
alter table public.court_blocks enable row level security;

drop policy if exists "court_blocks_staff_read" on public.court_blocks;
create policy "court_blocks_staff_read" on public.court_blocks
  for select to authenticated
  using (public.is_club_member(club_id) or public.is_platform_staff());

revoke all on table public.court_blocks from anon, authenticated;
grant select on table public.court_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- create_court_blocks: atomic creation of one block per court.
-- Returns { conflicts: [...], blocks: [...] }. When there is any conflict
-- (a pending/confirmed reservation or an existing block overlapping the range
-- on any of the courts) nothing is inserted and `blocks` is empty.
-- Raises 'COURT_NOT_IN_CLUB' (22023) when a court is not of the club.
-- ---------------------------------------------------------------------------
create or replace function public.create_court_blocks(
  p_club_id    uuid,
  p_court_ids  uuid[],
  p_start      timestamptz,
  p_end        timestamptz,
  p_reason     text,
  p_created_by uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_court     uuid;
  v_conflicts jsonb;
  v_blocks    jsonb;
begin
  if p_end <= p_start then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;
  if p_court_ids is null or cardinality(p_court_ids) = 0 then
    raise exception 'NO_COURTS' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_court_ids) as t(id)
    where not exists (select 1 from public.courts c where c.id = t.id and c.club_id = p_club_id)
  ) then
    raise exception 'COURT_NOT_IN_CLUB' using errcode = '22023';
  end if;

  -- Same lock, same order as the reservations trigger below.
  for v_court in select distinct t.id from unnest(p_court_ids) as t(id) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('court_blocks:' || v_court::text, 0));
  end loop;

  select coalesce(jsonb_agg(x.item order by x.starts_at, x.court_id), '[]'::jsonb)
    into v_conflicts
  from (
    select
      jsonb_build_object(
        'type', 'reservation',
        'id', r.id,
        'court_id', r.court_id,
        'start_time', r.start_time,
        'end_time', r.end_time,
        'status', r.status,
        'user', case when u.id is null then null
                else jsonb_build_object('id', u.id, 'first_name', u.first_name,
                                        'last_name', u.last_name, 'username', u.username) end,
        'match_id', m.id
      ) as item,
      r.start_time as starts_at,
      r.court_id as court_id
    from public.court_reservations r
    left join public.users u on u.id = r.user_id
    left join public.matches m on m.reservation_id = r.id
    where r.court_id = any (p_court_ids)
      and r.status in ('pending', 'confirmed')
      and r.start_time < p_end
      and r.end_time > p_start
    union all
    select
      jsonb_build_object(
        'type', 'block',
        'id', b.id,
        'court_id', b.court_id,
        'start_time', b.start_time,
        'end_time', b.end_time,
        'reason', b.reason
      ),
      b.start_time,
      b.court_id
    from public.court_blocks b
    where b.court_id = any (p_court_ids)
      and b.start_time < p_end
      and b.end_time > p_start
  ) x;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object('conflicts', v_conflicts, 'blocks', '[]'::jsonb);
  end if;

  with ins as (
    insert into public.court_blocks (club_id, court_id, start_time, end_time, reason, created_by)
    select p_club_id, d.id, p_start, p_end, p_reason, p_created_by
    from (select distinct t.id from unnest(p_court_ids) as t(id)) d
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(ins) order by ins.court_id), '[]'::jsonb)
    into v_blocks
  from ins;

  return jsonb_build_object('conflicts', '[]'::jsonb, 'blocks', v_blocks);
end;
$$;

revoke execute on function public.create_court_blocks(uuid, uuid[], timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_court_blocks(uuid, uuid[], timestamptz, timestamptz, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- A reservation cannot be inserted, or moved to another court or time, over a
-- block. Only inserts and changes of court/time are checked: confirming,
-- completing or cancelling an existing reservation never fails because of a
-- block. The API checks first and answers 409 COURT_BLOCKED; this is the net
-- for the race between a booking and a block being created.
-- ---------------------------------------------------------------------------
create or replace function public.court_reservations_check_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.court_id = old.court_id
     and new.start_time = old.start_time
     and new.end_time = old.end_time then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('court_blocks:' || new.court_id::text, 0));

  if exists (
    select 1 from public.court_blocks b
    where b.court_id = new.court_id
      and b.start_time < new.end_time
      and b.end_time > new.start_time
  ) then
    raise exception 'COURT_BLOCKED' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.court_reservations_check_blocks() from public, anon, authenticated;

drop trigger if exists court_reservations_check_blocks on public.court_reservations;
create trigger court_reservations_check_blocks
  before insert or update of court_id, start_time, end_time on public.court_reservations
  for each row execute function public.court_reservations_check_blocks();
