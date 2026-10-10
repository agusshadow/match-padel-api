-- Card #66 [Admin F0]: roles, club membership and per-club permissions.
--
-- Additive and backward compatible: nothing is dropped and `users.role` keeps
-- working for the player app. The API (service_role, bypasses RLS) now decides
-- authorization from `platform_staff` and `club_staff`; this migration adds the
-- tables, helpers and per-club read policies the database side needs.
--
-- Role mapping (the enum `staff_role` is NOT renamed: renames are destructive):
--   club_staff.role = 'owner'  -> Dueño
--   club_staff.role = 'admin'  -> Administrador
--   club_staff.role = 'staff'  -> Recepción
--   platform_staff.role = 'superadmin' | 'reviewer'
-- A superadmin is granted with:  insert into platform_staff (user_id, role) values ('<uuid>', 'superadmin');

-- ---------------------------------------------------------------------------
-- Platform roles
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.platform_role as enum ('superadmin', 'reviewer');
exception when duplicate_object then null; end $$;

create table if not exists public.platform_staff (
  user_id     uuid primary key references public.users(id) on delete cascade,
  role        public.platform_role not null,
  created_at  timestamptz not null default now()
);

alter table public.platform_staff enable row level security;

revoke all on table public.platform_staff from anon, authenticated;
grant select on table public.platform_staff to authenticated;

drop policy if exists "platform_staff_own_read" on public.platform_staff;
create policy "platform_staff_own_read" on public.platform_staff
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Everyone who is a super_admin today becomes a platform superadmin.
insert into public.platform_staff (user_id, role)
select id, 'superadmin'::public.platform_role
from public.users
where role = 'super_admin'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Audit log (written by the API only)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.users(id) on delete set null,
  club_id     uuid references public.clubs(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_club_created_idx on public.audit_log (club_id, created_at desc);
create index if not exists audit_log_actor_created_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
-- No policies on purpose: only service_role (the API) reads or writes it.
revoke all on table public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies never recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_staff where user_id = auth.uid());
$$;

create or replace function public.is_platform_superadmin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_staff
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

-- Member of the club in any role, or platform superadmin.
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_club_id is not null and (
    exists (
      select 1 from public.club_staff
      where club_id = p_club_id and user_id = auth.uid()
    )
    or public.is_platform_superadmin()
  );
$$;

-- Same, resolving the club through the court.
create or replace function public.is_court_club_member(p_court_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courts c
    where c.id = p_court_id and public.is_club_member(c.club_id)
  );
$$;

-- Same, resolving the club of a match through matches.club_id or its
-- reservation's court.
create or replace function public.is_match_club_member(p_match_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    left join public.court_reservations r on r.id = m.reservation_id
    where m.id = p_match_id
      and (
        public.is_club_member(m.club_id)
        or public.is_court_club_member(r.court_id)
      )
  );
$$;

revoke execute on function public.is_platform_staff() from public, anon;
revoke execute on function public.is_platform_superadmin() from public, anon;
revoke execute on function public.is_club_member(uuid) from public, anon;
revoke execute on function public.is_court_club_member(uuid) from public, anon;
revoke execute on function public.is_match_club_member(uuid) from public, anon;
grant execute on function public.is_platform_staff() to authenticated;
grant execute on function public.is_platform_superadmin() to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.is_court_club_member(uuid) to authenticated;
grant execute on function public.is_match_club_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-club read policies (replace the global "any club_staff" ones from #65)
-- ---------------------------------------------------------------------------
-- Staff policies are `to authenticated` because the helpers are not executable
-- by anon. Anonymous users never matched these predicates anyway.

-- tournaments: non-drafts are public; drafts only for their creator and the
-- staff of the tournament's club (or a superadmin).
drop policy if exists "tournaments_read" on public.tournaments;
drop policy if exists "tournaments_public_read" on public.tournaments;
drop policy if exists "tournaments_staff_read" on public.tournaments;
create policy "tournaments_public_read" on public.tournaments
  for select to anon, authenticated
  using (status <> 'draft');
create policy "tournaments_staff_read" on public.tournaments
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_club_member(club_id));

-- matches: creator, players, and staff of the match's club.
drop policy if exists "matches_participants_or_staff_read" on public.matches;
create policy "matches_participants_or_staff_read" on public.matches
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (select 1 from public.match_players mp where mp.match_id = matches.id and mp.user_id = (select auth.uid()))
    or public.is_match_club_member(id)
  );

-- match_players: own rows, and staff of the match's club (helper avoids the
-- matches <-> match_players policy recursion).
drop policy if exists "match_players_own_or_staff_read" on public.match_players;
create policy "match_players_own_or_staff_read" on public.match_players
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_match_club_member(match_id));

-- court_reservations: the owner, and staff of the court's club.
drop policy if exists "reservations_own_or_staff_read" on public.court_reservations;
create policy "reservations_own_or_staff_read" on public.court_reservations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_court_club_member(court_id));
