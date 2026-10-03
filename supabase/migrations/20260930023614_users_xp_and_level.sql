-- Card #61: level/XP, separate from ELO. ELO reflects skill (ranked match
-- outcomes only); level reflects app engagement and rises with XP earned by
-- playing (any match, ranked or friendly) — later also by completing
-- challenges once card #62 exists.
--
-- Curve: level L requires cumulative XP of 50*L*(L-1) to have been reached
-- (level 1->2 needs 100 XP, 2->3 needs 200 more, 3->4 needs 300 more, etc. —
-- a growing amount per level). Adjustable later; only the mechanism matters
-- now.

alter table public.users
  add column xp integer not null default 0,
  add column level integer not null default 1;

comment on column public.users.xp is 'Cumulative XP from playing matches (card #61) and, later, completing challenges (card #62). Separate from elo, which reflects skill via ranked match outcomes only.';
comment on column public.users.level is 'Derived from xp via the curve in award_match_xp/level_for_xp — app engagement, not skill.';

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

-- Card #61: awards participation XP to all 4 players of a match (20 XP) plus
-- a bonus to the winning team (+10 XP) whenever a result is confirmed —
-- called from inside accept_match_score so it commits atomically with the
-- ELO/stats/achievements it already handles.
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

-- Wire it into accept_match_score so a confirmed result always awards XP,
-- ranked or friendly (only ELO application itself is ranked-only).
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
  end loop;

  -- Card #61: XP/level for playing, independent of whether the match was ranked.
  perform award_match_xp(p_match_id, p_winner_team);

  return v_match;
end;
$$;

revoke all on function accept_match_score(uuid, smallint, boolean) from public, anon, authenticated;
grant execute on function accept_match_score(uuid, smallint, boolean) to service_role;
