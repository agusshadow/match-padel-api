-- Card #62: rotating challenges (daily/weekly/monthly/one_time), distinct
-- from the fixed one-time `achievements` (card #54). Deliberately minimal —
-- same "not the full condition-engine card #55 would need, just hand-matched
-- action types" call as achievements: only play_matches/win_matches for now.

create type challenge_cadence as enum ('daily', 'weekly', 'monthly', 'one_time');
create type challenge_action as enum ('play_matches', 'win_matches');
create type user_challenge_status as enum ('active', 'completed', 'expired');

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

create index on user_challenges(user_id, status);

alter table public.challenges enable row level security;
alter table public.user_challenges enable row level security;

create policy "challenges_public_read" on challenges for select using (is_active = true);
create policy "user_challenges_own_read" on user_challenges for select using (user_id = auth.uid());

-- Seed catalog: one example per cadence, matching the examples the user gave.
insert into challenges (code, name, description, cadence, action_type, target_count, reward_xp) values
  ('daily_play_1', 'Jugá un partido', 'Jugá 1 partido hoy', 'daily', 'play_matches', 1, 20),
  ('weekly_win_3', 'Ganador de la semana', 'Ganá 3 partidos esta semana', 'weekly', 'win_matches', 3, 100),
  ('monthly_play_10', 'Jugador constante', 'Jugá 10 partidos este mes', 'monthly', 'play_matches', 10, 300),
  ('onboarding_first_match', 'Primeros pasos', 'Jugá tu primer partido', 'one_time', 'play_matches', 1, 50);

-- Card #62: assigns each active user a fresh row per active challenge for
-- the current period (idempotent — the unique constraint above makes
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

-- Card #62: increments progress on the caller's active challenges matching
-- p_action, awarding reward_xp (and leveling up, via the same level_for_xp
-- from card #61) the moment a challenge's target is reached.
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

-- Wire into accept_match_score: both play_matches (all 4) and win_matches
-- (the 2 winners) progress whenever a result is confirmed, ranked or friendly.
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
