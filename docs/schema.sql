-- ============================================================
-- Match Padel — Initial Supabase schema
-- ============================================================
-- Run in the Supabase SQL Editor (Settings → SQL Editor)
-- Order: extensions → enums → tables → indexes → RLS → functions
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "btree_gist"; -- required by court_reservations.no_overlap

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('player', 'club_staff', 'super_admin');
create type staff_role as enum ('owner', 'admin', 'staff');
create type court_surface as enum ('indoor', 'outdoor', 'panoramic');
create type reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type match_type as enum ('friendly', 'ranked', 'tournament');
create type match_status as enum ('waiting', 'in_progress', 'completed', 'cancelled');
create type score_status as enum ('pending', 'accepted', 'disputed');
create type challenge_cadence as enum ('daily', 'weekly', 'monthly', 'one_time'); -- card #62
create type challenge_action as enum ('play_matches', 'win_matches'); -- card #62
create type user_challenge_status as enum ('active', 'completed', 'expired'); -- card #62
create type tournament_format as enum ('round_robin', 'single_elimination', 'double_elimination', 'americano');
create type tournament_status as enum ('draft', 'open', 'in_progress', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
create type notification_type as enum ('match_invite', 'score_submitted', 'tournament_update', 'reservation_reminder', 'system', 'match_started', 'match_cancelled', 'score_accepted', 'reservation_confirmed', 'reservation_cancelled');
create type skill_level as enum ('beginner', 'intermediate', 'advanced');
create type preferred_hand as enum ('drive', 'backhand');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- users: extends Supabase auth.users
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  first_name      text not null,
  last_name       text not null,
  full_name       text generated always as (
                    trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
                  ) stored,
  avatar_url      text,
  phone           text,
  elo             integer not null default 1000,          -- skill, ranked matches only
  xp              integer not null default 0,              -- card #61: engagement, separate from elo
  level           integer not null default 1,              -- derived from xp via level_for_xp()
  role            user_role not null default 'player',
  skill_level     skill_level,
  preferred_hand  preferred_hand,
  onboarding_completed_at timestamptz,
  is_active       boolean not null default true,
  fcm_token       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- clubs
create table public.clubs (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,
  description   text,
  address       text not null,
  city          text not null,
  phone         text,
  email         text,
  logo_url      text,
  cover_url     text,
  lat           double precision, -- WGS84, for the map view (Trello card #49)
  lng           double precision, -- WGS84, for the map view (Trello card #49)
  is_active     boolean not null default true,
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- club_staff: many-to-many relationship users ↔ clubs
create table public.club_staff (
  id            uuid primary key default uuid_generate_v4(),
  club_id       uuid not null references clubs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          staff_role not null default 'staff',
  created_at    timestamptz not null default now(),
  unique(club_id, user_id)
);

-- courts
create table public.courts (
  id            uuid primary key default uuid_generate_v4(),
  club_id       uuid not null references clubs(id) on delete cascade,
  name          text not null,
  surface       court_surface not null default 'indoor',
  is_indoor     boolean not null default true,
  price_per_hour numeric(10,2) not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- court_schedule: time availability per court
create table public.court_schedules (
  id            uuid primary key default uuid_generate_v4(),
  court_id      uuid not null references courts(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0=Sunday
  open_time     time not null,
  close_time    time not null,
  slot_minutes  smallint not null default 90,
  is_active     boolean not null default true
);

-- court_reservations (Supabase Realtime enabled here)
create table public.court_reservations (
  id            uuid primary key default uuid_generate_v4(),
  court_id      uuid not null references courts(id),
  user_id       uuid not null references users(id),
  club_id       uuid not null references clubs(id),
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  status        reservation_status not null default 'pending',
  total_price   numeric(10,2) not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    court_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status <> 'cancelled')
);

-- payments
create table public.payments (
  id              uuid primary key default uuid_generate_v4(),
  reservation_id  uuid references court_reservations(id),
  user_id         uuid not null references users(id),
  amount          numeric(10,2) not null,
  currency        text not null default 'ARS',
  status          payment_status not null default 'pending',
  mp_payment_id   text unique,
  mp_event_id     text unique,         -- webhook idempotency
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- matches
create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  club_id         uuid references clubs(id),
  reservation_id  uuid references court_reservations(id),
  tournament_id   uuid,                -- FK added later (circular)
  type            match_type not null default 'friendly',
  status          match_status not null default 'waiting',
  score_team1     integer[] default '{}',   -- [6,4,7] games won per set — set only once both teams' drafts agree
  score_team2     integer[] default '{}',
  score_status    score_status not null default 'pending',
  score_submitted_by uuid references users(id), -- unused since card #58 (independent submission replaced submit/accept-reject) — kept, not dropped
  pending_score_team1 jsonb,          -- card #58: team 1's claimed {"score_team1":[...],"score_team2":[...]} until both drafts match
  pending_score_team2 jsonb,          -- team 2's claimed result, same shape
  score_dispute_attempts integer not null default 0, -- mismatched draft pairs; 3 permanently sets score_status to disputed
  winner_team     smallint check (winner_team in (1, 2)),
  is_ranked       boolean not null default false,
  lobby_url       text,               -- random UUID for invitations
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- match_players: 4 players per match
create table public.match_players (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references matches(id) on delete cascade,
  user_id     uuid not null references users(id),
  team        smallint not null check (team in (1, 2)),
  joined_at   timestamptz not null default now(),
  unique(match_id, user_id)
);

-- match_chats
create table public.match_chats (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references matches(id) on delete cascade,
  user_id     uuid not null references users(id),
  message     text not null,
  created_at  timestamptz not null default now()
);

-- tournaments
create table public.tournaments (
  id            uuid primary key default uuid_generate_v4(),
  club_id       uuid not null references clubs(id),
  name          text not null,
  description   text,
  format        tournament_format not null default 'single_elimination',
  status        tournament_status not null default 'draft',
  max_teams     integer not null default 8,
  entry_fee     numeric(10,2) not null default 0,
  prize_pool    numeric(10,2) not null default 0,
  start_date    timestamptz not null,
  end_date      timestamptz,
  rules         jsonb not null default '{}',
  bracket       jsonb not null default '{}',  -- bracket structure
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- circular FK tournaments ↔ matches
alter table public.matches
  add constraint matches_tournament_id_fkey
  foreign key (tournament_id) references tournaments(id);

-- tournament_teams
create table public.tournament_teams (
  id              uuid primary key default uuid_generate_v4(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  name            text not null,
  player1_id      uuid not null references users(id),
  player2_id      uuid not null references users(id),
  seed            integer,
  registered_at   timestamptz not null default now(),
  unique(tournament_id, player1_id),
  unique(tournament_id, player2_id)
);

-- elo_history: ELO change history
create table public.elo_history (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  match_id    uuid not null references matches(id),
  elo_before  integer not null,
  elo_after   integer not null,
  delta       integer not null,
  created_at  timestamptz not null default now()
);

-- achievements (catalog)
create table public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  name        text not null,
  description text not null,
  icon        text not null,
  points      integer not null default 0,
  condition   jsonb not null default '{}'
);

-- user_achievements
create table public.user_achievements (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  achievement_id  uuid not null references achievements(id),
  earned_at       timestamptz not null default now(),
  unique(user_id, achievement_id)
);

-- challenges (card #62): rotating catalog, distinct from the fixed one-time
-- achievements above. Deliberately minimal — same "not the full
-- condition-engine card #55 would need" call as achievements: only two
-- action types for now.
create table public.challenges (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique not null,
  name            text not null,
  description     text not null,
  cadence         challenge_cadence not null,
  action_type     challenge_action not null,
  target_count    integer not null check (target_count > 0),
  reward_xp       integer not null default 0,
  reward_currency integer not null default 0, -- card #63: paid out once the internal currency exists
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- user_challenges: per-user, per-period progress
create table public.user_challenges (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id),
  challenge_id  uuid not null references challenges(id),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  progress      integer not null default 0,
  status        user_challenge_status not null default 'active',
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, challenge_id, period_start)
);

-- points_transactions: points store
create table public.points_transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  delta       integer not null,         -- positive or negative
  reason      text not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- user_stats: counter-cache for the profile (card #56). Kept up to date by
-- trg_update_user_stats (fires when a match transitions to 'completed');
-- never written to directly. getStats reads this instead of recomputing from
-- match_players/matches on every request.
create table public.user_stats (
  user_id       uuid primary key references users(id) on delete cascade,
  total_matches integer not null default 0,
  wins          integer not null default 0,
  losses        integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- notifications
create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  type        notification_type not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}',
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on court_reservations(court_id, start_time);
create index on court_reservations(user_id);
create index on court_reservations(club_id, status);
create index on matches(club_id, status);
create index on matches(created_by);
create index on match_players(user_id);
create index on match_players(match_id);
create index on match_chats(match_id, created_at);
create index on tournament_teams(tournament_id);
create index on elo_history(user_id, created_at desc);
create index on notifications(user_id, is_read, created_at desc);
create index on payments(mp_event_id);
create index on users(elo desc) where is_active = true;
create index on user_challenges(user_id, status); -- card #62

-- ============================================================
-- SUPABASE REALTIME (court_reservations only)
-- ============================================================
alter publication supabase_realtime add table court_reservations;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Note: the API uses service_role (bypasses RLS).
-- RLS protects direct frontend access via the anon key.

alter table users enable row level security;
alter table clubs enable row level security;
alter table club_staff enable row level security;
alter table courts enable row level security;
alter table court_schedules enable row level security;
alter table court_reservations enable row level security;
alter table payments enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table match_chats enable row level security;
alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table elo_history enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table points_transactions enable row level security;
alter table notifications enable row level security;
alter table user_stats enable row level security;
alter table challenges enable row level security; -- card #62
alter table user_challenges enable row level security; -- card #62

-- Basic access policies from the frontend (anon key)

-- users: anyone can view public profiles
create policy "users_public_read" on users for select using (true);
create policy "users_own_update" on users for update using (auth.uid() = id);

-- Column-level grants (cards #10/#11, risks R1/R2): the row policies above only
-- restrict WHICH ROWS can be selected/updated, not which columns. Without these
-- grants, any authenticated user could update their own `role`/`elo`/`is_active`,
-- and anyone with the anon key could read every user's `phone`/`fcm_token`.
-- service_role (used by the API) is untouched and keeps full column access.
revoke select on table users from anon, authenticated;
grant select (
  id, username, first_name, last_name, full_name, avatar_url, elo, role,
  skill_level, preferred_hand, created_at, is_active
) on table users to anon, authenticated;

revoke update on table users from anon, authenticated;
-- full_name is a GENERATED column (see below) and was never actually updatable;
-- first_name/last_name are the real columns behind a user's display name.
grant update (first_name, last_name, phone, avatar_url) on table users to authenticated;

-- clubs: public read
create policy "clubs_public_read" on clubs for select using (is_active = true);

-- courts: public read
create policy "courts_public_read" on courts for select using (is_active = true);

-- court_schedules: public read
create policy "schedules_public_read" on court_schedules for select using (is_active = true);

-- court_reservations: user sees their own
create policy "reservations_own_read" on court_reservations for select using (auth.uid() = user_id);

-- matches: players see matches they participate in
create policy "matches_participants_read" on matches for select using (
  exists (select 1 from match_players where match_id = id and user_id = auth.uid())
  or created_by = auth.uid()
);

-- match_chats: same
create policy "chats_participants_read" on match_chats for select using (
  exists (select 1 from match_players where match_id = match_chats.match_id and user_id = auth.uid())
);

-- tournaments: public read
create policy "tournaments_public_read" on tournaments for select using (status <> 'draft');

-- tournament_teams: public read
create policy "tournament_teams_public_read" on tournament_teams for select using (true);

-- achievements: public catalog
create policy "achievements_public_read" on achievements for select using (true);

-- user_achievements: public
create policy "user_achievements_public_read" on user_achievements for select using (true);

-- elo_history: public
create policy "elo_history_public_read" on elo_history for select using (true);

-- challenges: public catalog (card #62)
create policy "challenges_public_read" on challenges for select using (is_active = true);

-- user_challenges: own progress only
create policy "user_challenges_own_read" on user_challenges for select using (user_id = auth.uid());

-- notifications: owner only
create policy "notifications_own_read" on notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on notifications for update using (auth.uid() = user_id);

-- payments: owner only
create policy "payments_own_read" on payments for select using (auth.uid() = user_id);

-- points_transactions: owner only
create policy "points_own_read" on points_transactions for select using (auth.uid() = user_id);

-- user_stats: public (same visibility as elo/achievements — part of a public profile)
create policy "user_stats_public_read" on user_stats for select using (true);

-- ============================================================
-- TRIGGER: automatic updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on users for each row execute function update_updated_at();
create trigger set_updated_at before update on clubs for each row execute function update_updated_at();
create trigger set_updated_at before update on courts for each row execute function update_updated_at();
create trigger set_updated_at before update on court_reservations for each row execute function update_updated_at();
create trigger set_updated_at before update on payments for each row execute function update_updated_at();
create trigger set_updated_at before update on matches for each row execute function update_updated_at();
create trigger set_updated_at before update on tournaments for each row execute function update_updated_at();

-- ============================================================
-- FUNCTION: accept_match_score (card #21 atomic score+ELO; card #54 awards
-- achievements using the counter-cache the same transaction just updated)
-- ============================================================
-- Accepting a score and, on a ranked match, applying +15/-15 ELO to all 4
-- players used to be several separate API calls with no transaction — a
-- failure partway could leave a match "completed" with only some players'
-- ELO updated. This runs as one Postgres function call, so it all commits or
-- rolls back together. Only service_role may call it (see grants below) —
-- the app-level ownership/self-accept checks live in match.service.ts.
create or replace function accept_match_score(
  p_match_id uuid,
  p_winner_team smallint,
  p_apply_elo boolean
)
returns matches
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_match matches;
  mp record;
  v_elo_before integer;
  v_elo_after integer;
  v_delta integer;
  v_stats user_stats;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if v_match.score_status <> 'pending' then
    raise exception 'NO_PENDING_SCORE';
  end if;

  update matches
  set score_status = 'accepted',
      winner_team = p_winner_team,
      status = 'completed',
      updated_at = now()
  where id = p_match_id
  returning * into v_match;
  -- trg_update_user_stats already ran by this point (AFTER UPDATE, same statement).

  for mp in select user_id, team from match_players where match_id = p_match_id loop
    if p_apply_elo then
      v_delta := case when mp.team = p_winner_team then 15 else -15 end;

      select elo into v_elo_before from users where id = mp.user_id for update;
      v_elo_after := greatest(0, v_elo_before + v_delta);

      update users set elo = v_elo_after, updated_at = now() where id = mp.user_id;

      insert into elo_history (user_id, match_id, elo_before, elo_after, delta)
      values (mp.user_id, p_match_id, v_elo_before, v_elo_after, v_delta);
    end if;

    -- Card #54: award achievements based on the just-updated counter-cache.
    -- Deliberately minimal (not the full condition-engine card #55 would
    -- need) — just the 3 seeded achievements below, matched by hand.
    select * into v_stats from user_stats where user_id = mp.user_id;
    if v_stats.total_matches = 1 then
      insert into user_achievements (user_id, achievement_id)
      select mp.user_id, id from achievements where code = 'first_match'
      on conflict (user_id, achievement_id) do nothing;
    end if;
    if v_stats.wins = 1 then
      insert into user_achievements (user_id, achievement_id)
      select mp.user_id, id from achievements where code = 'first_win'
      on conflict (user_id, achievement_id) do nothing;
    end if;
    if v_stats.wins = 5 then
      insert into user_achievements (user_id, achievement_id)
      select mp.user_id, id from achievements where code = 'five_wins'
      on conflict (user_id, achievement_id) do nothing;
    end if;

    -- Card #62: challenge progress, independent of ranked/friendly.
    perform increment_challenge_progress(mp.user_id, 'play_matches', 1);
    if mp.team = p_winner_team then
      perform increment_challenge_progress(mp.user_id, 'win_matches', 1);
    end if;
  end loop;

  -- Card #61: XP/level for playing, independent of whether the match was ranked.
  perform award_match_xp(p_match_id, p_winner_team);

  return v_match;
end;
$$;

revoke all on function accept_match_score(uuid, smallint, boolean) from public, anon, authenticated;
grant execute on function accept_match_score(uuid, smallint, boolean) to service_role;

-- ============================================================
-- FUNCTIONS: level_for_xp, award_match_xp (card #61)
-- ============================================================
-- Level/XP is separate from ELO: ELO reflects skill (ranked match outcomes
-- only), level reflects app engagement and rises with XP from playing any
-- match (later also from completing challenges, card #62). Curve: level L
-- requires cumulative XP of 50*L*(L-1) — level 1->2 needs 100 XP, 2->3 needs
-- 200 more, 3->4 needs 300 more, etc. Adjustable later; only the mechanism
-- matters now.
create or replace function level_for_xp(p_xp integer)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select greatest(1, floor((1 + sqrt(1 + 0.08 * p_xp::numeric)) / 2)::integer);
$$;

revoke all on function level_for_xp(integer) from public, anon, authenticated;
grant execute on function level_for_xp(integer) to service_role;

-- Awards participation XP to all 4 players of a match (20 XP) plus a bonus
-- to the winning team (+10 XP, i.e. 30 total) whenever a result is
-- confirmed. Called from inside accept_match_score so it commits atomically
-- with the ELO/stats/achievements it already handles.
create or replace function award_match_xp(p_match_id uuid, p_winner_team smallint)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  mp record;
  v_gain integer;
  v_new_xp integer;
begin
  for mp in select user_id, team from match_players where match_id = p_match_id loop
    v_gain := case when mp.team = p_winner_team then 30 else 20 end;

    update users
    set xp = xp + v_gain,
        level = level_for_xp(xp + v_gain),
        updated_at = now()
    where id = mp.user_id
    returning xp into v_new_xp;
  end loop;
end;
$$;

revoke all on function award_match_xp(uuid, smallint) from public, anon, authenticated;
grant execute on function award_match_xp(uuid, smallint) to service_role;

-- ============================================================
-- FUNCTIONS: assign_and_expire_challenges, increment_challenge_progress (card #62)
-- ============================================================
-- Assigns each active user a fresh row per active challenge for the current
-- period (idempotent — the unique constraint on user_challenges makes
-- ON CONFLICT DO NOTHING safe to call repeatedly), and expires rows whose
-- period has ended. Called from a scheduled job, same pattern as
-- expire-reservations/auto-cancel-unfilled-matches.
create or replace function assign_and_expire_challenges()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update user_challenges
  set status = 'expired'
  where status = 'active' and period_end <= now();

  insert into user_challenges (user_id, challenge_id, period_start, period_end)
  select
    u.id,
    c.id,
    case c.cadence
      when 'daily' then date_trunc('day', now())
      when 'weekly' then date_trunc('week', now())
      when 'monthly' then date_trunc('month', now())
      when 'one_time' then 'epoch'::timestamptz
    end as period_start,
    case c.cadence
      when 'daily' then date_trunc('day', now()) + interval '1 day'
      when 'weekly' then date_trunc('week', now()) + interval '7 days'
      when 'monthly' then date_trunc('month', now()) + interval '1 month'
      when 'one_time' then 'infinity'::timestamptz
    end as period_end
  from users u
  cross join challenges c
  where u.is_active and c.is_active
  on conflict (user_id, challenge_id, period_start) do nothing;
end;
$$;

revoke all on function assign_and_expire_challenges() from public, anon, authenticated;
grant execute on function assign_and_expire_challenges() to service_role;

-- Increments progress on the caller's active challenges matching p_action,
-- awarding reward_xp (and leveling up, via level_for_xp from card #61) the
-- moment a challenge's target is reached.
create or replace function increment_challenge_progress(p_user_id uuid, p_action challenge_action, p_amount integer default 1)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  uc record;
  v_new_progress integer;
begin
  for uc in
    select ucg.id, ucg.progress, c.target_count, c.reward_xp
    from user_challenges ucg
    join challenges c on c.id = ucg.challenge_id
    where ucg.user_id = p_user_id
      and ucg.status = 'active'
      and c.action_type = p_action
      and now() >= ucg.period_start and now() < ucg.period_end
  loop
    v_new_progress := uc.progress + p_amount;

    if v_new_progress >= uc.target_count then
      update user_challenges
      set progress = v_new_progress, status = 'completed', completed_at = now()
      where id = uc.id;

      update users
      set xp = xp + uc.reward_xp,
          level = level_for_xp(xp + uc.reward_xp),
          updated_at = now()
      where id = p_user_id;
    else
      update user_challenges set progress = v_new_progress where id = uc.id;
    end if;
  end loop;
end;
$$;

revoke all on function increment_challenge_progress(uuid, challenge_action, integer) from public, anon, authenticated;
grant execute on function increment_challenge_progress(uuid, challenge_action, integer) to service_role;

-- ============================================================
-- FUNCTION: submit_match_score_draft (card #58)
-- ============================================================
-- Replaces "one team submits, the other accepts/rejects" (exploitable — a
-- losing team can reject forever with no way to verify what really
-- happened). Each team submits their own claimed score as a draft; once both
-- teams' drafts exist and match exactly, the match confirms automatically
-- (calling accept_match_score for the same atomic ELO/stats/achievements
-- handling). A mismatch clears both drafts and bumps score_dispute_attempts;
-- reaching 3 permanently sets score_status to 'disputed' — no ELO, no stats,
-- for either ranked or friendly matches (only ELO application itself is
-- ranked-only). Only service_role may call it — team ownership/self checks
-- live in match.service.ts.
create or replace function submit_match_score_draft(
  p_match_id uuid,
  p_team smallint,
  p_draft jsonb
)
returns matches
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_match matches;
  v_score1 integer[];
  v_score2 integer[];
  v_sets1 int := 0;
  v_sets2 int := 0;
  v_winner smallint;
  i int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if v_match.score_status = 'disputed' then
    raise exception 'MATCH_PERMANENTLY_DISPUTED';
  end if;
  if v_match.score_status = 'accepted' then
    raise exception 'SCORE_ALREADY_ACCEPTED';
  end if;

  if p_team = 1 then
    update matches set pending_score_team1 = p_draft, updated_at = now()
    where id = p_match_id returning * into v_match;
  else
    update matches set pending_score_team2 = p_draft, updated_at = now()
    where id = p_match_id returning * into v_match;
  end if;

  if v_match.pending_score_team1 is null or v_match.pending_score_team2 is null then
    return v_match; -- waiting on the other team's draft
  end if;

  if v_match.pending_score_team1 = v_match.pending_score_team2 then
    select array(select jsonb_array_elements_text(v_match.pending_score_team1->'score_team1'))::integer[] into v_score1;
    select array(select jsonb_array_elements_text(v_match.pending_score_team1->'score_team2'))::integer[] into v_score2;

    for i in 1..least(coalesce(array_length(v_score1,1),0), coalesce(array_length(v_score2,1),0)) loop
      if v_score1[i] > v_score2[i] then v_sets1 := v_sets1 + 1;
      elsif v_score2[i] > v_score1[i] then v_sets2 := v_sets2 + 1;
      end if;
    end loop;
    v_winner := case when v_sets1 > v_sets2 then 1 else 2 end;

    update matches
    set score_team1 = v_score1,
        score_team2 = v_score2,
        pending_score_team1 = null,
        pending_score_team2 = null,
        score_dispute_attempts = 0,
        updated_at = now()
    where id = p_match_id;

    return accept_match_score(p_match_id, v_winner, v_match.is_ranked);
  else
    update matches
    set pending_score_team1 = null,
        pending_score_team2 = null,
        score_dispute_attempts = score_dispute_attempts + 1,
        score_status = case when score_dispute_attempts + 1 >= 3 then 'disputed'::score_status else 'pending'::score_status end,
        updated_at = now()
    where id = p_match_id
    returning * into v_match;

    return v_match;
  end if;
end;
$$;

revoke all on function submit_match_score_draft(uuid, smallint, jsonb) from public, anon, authenticated;
grant execute on function submit_match_score_draft(uuid, smallint, jsonb) to service_role;

-- Card #54 seed data: a deliberately small starter catalog (not the full
-- gamification system from card #55) that turns on the previously-dormant
-- achievements table.
insert into achievements (code, name, description, icon, points, condition)
values
  ('first_match', 'Primer partido', 'Jugaste tu primer partido', 'trophy', 10, '{"type": "matches_played", "count": 1}'),
  ('first_win', 'Primera victoria', 'Ganaste tu primer partido', 'medal', 20, '{"type": "wins", "count": 1}'),
  ('five_wins', 'Racha ganadora', 'Ganaste 5 partidos', 'flame', 50, '{"type": "wins", "count": 5}')
on conflict (code) do nothing;

-- Card #62 seed data: one example per cadence, matching the examples given
-- when this feature was scoped.
insert into challenges (code, name, description, cadence, action_type, target_count, reward_xp) values
  ('daily_play_1', 'Jugá un partido', 'Jugá 1 partido hoy', 'daily', 'play_matches', 1, 20),
  ('weekly_win_3', 'Ganador de la semana', 'Ganá 3 partidos esta semana', 'weekly', 'win_matches', 3, 100),
  ('monthly_play_10', 'Jugador constante', 'Jugá 10 partidos este mes', 'monthly', 'play_matches', 10, 300),
  ('onboarding_first_match', 'Primeros pasos', 'Jugá tu primer partido', 'one_time', 'play_matches', 1, 50)
on conflict (code) do nothing;

-- ============================================================
-- TRIGGER: keep user_stats in sync (card #56, counter-cache)
-- ============================================================
create or replace function update_user_stats_on_match_completed()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  mp record;
  is_win boolean;
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.winner_team is not null then
    for mp in select user_id, team from match_players where match_id = new.id loop
      is_win := (mp.team = new.winner_team);
      insert into user_stats (user_id, total_matches, wins, losses, updated_at)
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
$$;

create trigger trg_update_user_stats
after update on matches
for each row execute function update_user_stats_on_match_completed();

-- ============================================================
-- TRIGGER: create user profile on sign-up
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, first_name, last_name, username, avatar_url, skill_level, preferred_hand)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'last_name', '-'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'skill_level', '')::skill_level,
    nullif(new.raw_user_meta_data->>'preferred_hand', '')::preferred_hand
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- STORAGE (card #53)
-- ============================================================
-- Public bucket for profile pictures. Writes only go through the API
-- (service_role bypasses storage RLS) — no anon/authenticated storage
-- policies, direct client uploads aren't the design.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

