-- Card #77 [Admin F4]: tournaments managed by the club (API half).
--
-- Additive and backward compatible. The API in production only ever inserts a
-- tournament as `open`, a team without a status and never writes the new
-- columns, so every default below reproduces what it does today:
--   * tournament_teams.status defaults to 'confirmed' (a registration with no
--     payment step is a confirmed one);
--   * every new column on tournaments / tournament_matches is nullable or has a
--     neutral default.
--
-- What it adds
--   tournaments        category, min_elo/max_elo (level limits), registration_deadline,
--                      started_at, completed_at, cancelled_at, cancel_reason.
--   tournament_teams   status ('pending_payment' | 'confirmed'), expires_at (the
--                      TTL of an unpaid registration), paid_at, payment_id.
--   tournament_matches stage, position and the bracket links (next_match_id /
--                      loser_next_match_id with their slot), the players of an
--                      americano match, who recorded the result and when.
--   payments           tournament_id, tournament_team_id: a registration fee is a
--                      payment of a tournament team instead of a reservation
--                      (reservation_id was already nullable).
--
-- RLS (docs/permissions.md): read policies are made consistent with the rest of
-- the club platform. Players read the matches and CONFIRMED teams of public
-- tournaments (not a draft, club approved and active); the two players of a team
-- read their own registration whatever its status; members of the tournament's
-- club (and platform superadmins, through is_club_member) read everything. The
-- old policies of tournament_teams and tournament_matches were `using (true)`:
-- they exposed unpaid registrations and the teams/matches of draft tournaments.
-- Nobody writes from the client (no write policies, as before).

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists category text,
  add column if not exists min_elo integer,
  add column if not exists max_elo integer,
  add column if not exists registration_deadline timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_elo_range_check' and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_elo_range_check
      check (
        (min_elo is null or min_elo >= 0)
        and (max_elo is null or max_elo >= 0)
        and (min_elo is null or max_elo is null or min_elo <= max_elo)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- tournament_teams: registration payment state
-- ---------------------------------------------------------------------------
alter table public.tournament_teams
  add column if not exists status text not null default 'confirmed',
  add column if not exists expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournament_teams_status_check' and conrelid = 'public.tournament_teams'::regclass
  ) then
    alter table public.tournament_teams
      add constraint tournament_teams_status_check
      check (status in ('pending_payment', 'confirmed'));
  end if;
end $$;

create index if not exists tournament_teams_status_idx on public.tournament_teams (tournament_id, status);
create index if not exists tournament_teams_pending_expiry_idx
  on public.tournament_teams (expires_at) where status = 'pending_payment';
create index if not exists tournament_teams_payment_id_idx on public.tournament_teams (payment_id);

-- ---------------------------------------------------------------------------
-- payments: a registration fee belongs to a tournament team
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null,
  add column if not exists tournament_team_id uuid references public.tournament_teams(id) on delete set null;

create index if not exists payments_tournament_idx on public.payments (tournament_id) where tournament_id is not null;
create index if not exists payments_tournament_team_idx on public.payments (tournament_team_id) where tournament_team_id is not null;

-- ---------------------------------------------------------------------------
-- tournament_matches: fixture position, bracket links, americano players
--   stage    group (round robin), main (single elimination), winners / losers /
--            grand_final (double elimination), americano.
--   status   pending (waiting for teams), ready (both known), completed,
--            bye (auto-resolved: one side never exists), void (nobody ever plays it).
-- ---------------------------------------------------------------------------
alter table public.tournament_matches
  add column if not exists stage text not null default 'main',
  add column if not exists position integer,
  add column if not exists next_match_id uuid references public.tournament_matches(id) on delete set null,
  add column if not exists next_match_slot smallint,
  add column if not exists loser_next_match_id uuid references public.tournament_matches(id) on delete set null,
  add column if not exists loser_next_match_slot smallint,
  add column if not exists team1_players uuid[],
  add column if not exists team2_players uuid[],
  add column if not exists result_by uuid references public.users(id) on delete set null,
  add column if not exists result_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournament_matches_slots_check' and conrelid = 'public.tournament_matches'::regclass
  ) then
    alter table public.tournament_matches
      add constraint tournament_matches_slots_check
      check (
        (next_match_slot is null or next_match_slot in (1, 2))
        and (loser_next_match_slot is null or loser_next_match_slot in (1, 2))
      );
  end if;
end $$;

create unique index if not exists tournament_matches_position_key
  on public.tournament_matches (tournament_id, stage, round, position);
create index if not exists tournament_matches_next_match_idx
  on public.tournament_matches (next_match_id) where next_match_id is not null;
create index if not exists tournament_matches_loser_next_match_idx
  on public.tournament_matches (loser_next_match_id) where loser_next_match_id is not null;
create index if not exists tournament_matches_result_by_idx
  on public.tournament_matches (result_by) where result_by is not null;

drop trigger if exists set_updated_at on public.tournament_matches;
create trigger set_updated_at before update on public.tournament_matches
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS read policies
-- ---------------------------------------------------------------------------
-- tournaments: a non-draft tournament of an approved, active club is public;
-- members of the club read all their tournaments (existing tournaments_staff_read).
drop policy if exists "tournaments_public_read" on public.tournaments;
create policy "tournaments_public_read" on public.tournaments
  for select to anon, authenticated
  using (
    status <> 'draft'
    and exists (
      select 1 from public.clubs c
      where c.id = tournaments.club_id and c.status = 'approved' and c.is_active
    )
  );

-- Teams and matches inherit the visibility of their tournament: the subquery on
-- `tournaments` runs under the caller's own RLS, so only a tournament the caller
-- may read can qualify.
drop policy if exists "tournament_teams_public_read" on public.tournament_teams;
create policy "tournament_teams_public_read" on public.tournament_teams
  for select to anon, authenticated
  using (
    status = 'confirmed'
    and exists (select 1 from public.tournaments t where t.id = tournament_teams.tournament_id)
  );

drop policy if exists "tournament_teams_own_read" on public.tournament_teams;
create policy "tournament_teams_own_read" on public.tournament_teams
  for select to authenticated
  using ((select auth.uid()) in (player1_id, player2_id));

drop policy if exists "tournament_teams_staff_read" on public.tournament_teams;
create policy "tournament_teams_staff_read" on public.tournament_teams
  for select to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_teams.tournament_id and public.is_club_member(t.club_id)
    )
  );

drop policy if exists "tournament_matches_public_read" on public.tournament_matches;
create policy "tournament_matches_public_read" on public.tournament_matches
  for select to anon, authenticated
  using (
    exists (select 1 from public.tournaments t where t.id = tournament_matches.tournament_id)
  );
