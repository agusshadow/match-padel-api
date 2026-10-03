-- Card #21 (R12): accepting a score and applying ELO to all 4 players used to
-- be 1 (status update) + up to 4x3 separate round trips from the API, with no
-- transaction — a failure partway left the match "completed" with only some
-- players' ELO updated. This wraps it all in one function call, which
-- Postgres runs as a single transaction: any error rolls everything back.
create or replace function public.accept_match_score(
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

  if p_apply_elo then
    for mp in select user_id, team from match_players where match_id = p_match_id loop
      v_delta := case when mp.team = p_winner_team then 15 else -15 end;

      select elo into v_elo_before from users where id = mp.user_id for update;
      v_elo_after := greatest(0, v_elo_before + v_delta);

      update users set elo = v_elo_after, updated_at = now() where id = mp.user_id;

      insert into elo_history (user_id, match_id, elo_before, elo_after, delta)
      values (mp.user_id, p_match_id, v_elo_before, v_elo_after, v_delta);
    end loop;
  end if;

  return v_match;
end;
$$;

-- Only the API (service_role) should be able to call this — it bypasses the
-- app-level ownership/self-accept checks in match.service.ts.
revoke all on function public.accept_match_score(uuid, smallint, boolean) from public, anon, authenticated;
grant execute on function public.accept_match_score(uuid, smallint, boolean) to service_role;