-- ============================================================
-- Sync the baseline with what production actually has
-- ============================================================
-- Found while building the dev project (card #1): the retrofitted baseline
-- (20260929230854) did not match production. Applying baseline + the four
-- later migrations to an empty project left it behind production in:
--   * the tournament_matches table (missing entirely)
--   * indexes on notifications and tournaments
--   * RLS policies on court_reservations, match_players, matches,
--     notifications, tournament_teams, tournaments
--   * bodies of handle_new_user and update_user_stats_on_match_completed
--   * pg_cron (installed by the baseline, not present in production)
-- This migration closes that gap so a from-scratch project ends up identical
-- to production. NEVER run it against production: everything here already
-- exists there. It is for fresh projects (dev, or a rebuild) only.
--
-- KNOWN ISSUES COPIED FAITHFULLY FROM PRODUCTION (not fixed here on purpose —
-- a dev project must mirror prod, and tightening prod needs a human go-ahead;
-- fix both in a separate migration):
--   * tournament_matches_service_write is FOR ALL TO public with check(true),
--     so the anon key can write the table (it was meant for service_role,
--     which bypasses RLS anyway).
--   * notifications has two redundant INSERT policies with check(true) for
--     public, so any anon-key client can insert notifications for anyone.
--   * notifications and match_players also carry duplicated/overlapping
--     read/update policies.
--   * matches_public_read / tournaments_public_read expose every row,
--     including draft tournaments.
-- ============================================================

drop extension if exists pg_cron;

-- tournament_matches ------------------------------------------------------
create table public.tournament_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  match_id       uuid references matches(id) on delete set null,
  round          integer not null default 1,
  team1_id       uuid references tournament_teams(id),
  team2_id       uuid references tournament_teams(id),
  winner_team_id uuid references tournament_teams(id),
  score_team1    integer[],
  score_team2    integer[],
  status         text not null default 'pending',
  scheduled_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index tournament_matches_tournament_id_idx on public.tournament_matches(tournament_id);

alter table public.tournament_matches enable row level security;

create policy "tournament_matches_public_read" on tournament_matches for select using (true);
create policy "tournament_matches_service_write" on tournament_matches for all with check (true);

-- indexes -----------------------------------------------------------------
create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);
create index notifications_user_id_is_read_idx on public.notifications(user_id, is_read) where is_read = false;
create index tournaments_start_date_idx on public.tournaments(start_date);
create index tournaments_status_idx on public.tournaments(status);

-- policies ----------------------------------------------------------------
create policy "reservations_own_insert" on court_reservations for insert with check (auth.uid() = user_id);
create policy "reservations_own_update" on court_reservations for update using (auth.uid() = user_id);

create policy "match_players_own_insert" on match_players for insert with check (auth.uid() = user_id);
create policy "match_players_public_read" on match_players for select using (true);

drop policy "matches_participants_read" on matches;
create policy "matches_own_insert" on matches for insert with check (auth.uid() = created_by);
create policy "matches_own_update" on matches for update using (auth.uid() = created_by);
create policy "matches_public_read" on matches for select using (true);

create policy "notifications_service_insert" on notifications for insert with check (true);
create policy "service_role_insert_notifications" on notifications for insert with check (true);
create policy "users_read_own_notifications" on notifications for select using (auth.uid() = user_id);
create policy "users_update_own_notifications" on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tournament_teams_auth_insert" on tournament_teams for insert
  with check ((auth.uid() = player1_id) or (auth.uid() = player2_id));
create policy "tournament_teams_player_delete" on tournament_teams for delete
  using ((auth.uid() = player1_id) or (auth.uid() = player2_id));

drop policy "tournaments_public_read" on tournaments;
create policy "tournaments_public_read" on tournaments for select using (true);
create policy "tournaments_auth_insert" on tournaments for insert with check (auth.uid() is not null);
create policy "tournaments_creator_update" on tournaments for update
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- functions: bodies as they are in production -------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.users (id, first_name, last_name, username, avatar_url, skill_level, preferred_hand)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'last_name', '-'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'skill_level', '')::public.skill_level,
    nullif(new.raw_user_meta_data->>'preferred_hand', '')::public.preferred_hand
  );
  return new;
end;
$function$;

create or replace function public.update_user_stats_on_match_completed()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  mp record;
  is_win boolean;
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.winner_team is not null then
    for mp in select user_id, team from match_players where match_id = new.id loop
      is_win := (mp.team = new.winner_team);
      insert into public.user_stats (user_id, total_matches, wins, losses, updated_at)
      values (
        mp.user_id, 1,
        case when is_win then 1 else 0 end,
        case when is_win then 0 else 1 end,
        now()
      )
      on conflict (user_id) do update set
        total_matches = user_stats.total_matches + 1,
        wins = user_stats.wins + excluded.wins,
        losses = user_stats.losses + excluded.losses,
        updated_at = now();
    end loop;
  end if;
  return new;
end;
$function$;
