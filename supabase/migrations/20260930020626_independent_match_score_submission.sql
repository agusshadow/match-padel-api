-- Card #58: replace "one team submits, the other accepts/rejects" (exploitable —
-- a losing team can reject forever) with independent submission by each team.
-- Each team submits their own claimed score as a draft; the match confirms
-- automatically once both drafts match exactly. A mismatch clears both drafts
-- and bumps a counter; after 3 mismatches the match is permanently disputed
-- (no ELO, no stats for anyone — same for ranked and friendly, only ELO
-- application differs).

alter table public.matches
  add column pending_score_team1 jsonb,
  add column pending_score_team2 jsonb,
  add column score_dispute_attempts integer not null default 0;

comment on column public.matches.pending_score_team1 is 'Team 1''s claimed result, shape {"score_team1": [...], "score_team2": [...]} — cleared once both teams'' drafts are compared.';
comment on column public.matches.pending_score_team2 is 'Team 2''s claimed result, same shape as pending_score_team1.';
comment on column public.matches.score_dispute_attempts is 'Count of mismatched draft pairs; reaching 3 permanently sets score_status to disputed.';
comment on column public.matches.score_submitted_by is 'Unused since card #58 (independent submission replaced the submit/accept-reject flow) — kept, not dropped, since it holds no meaningful data to migrate.';

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
