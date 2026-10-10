-- Card #78 [Admin F5]: gamification catalogs administered from the platform
-- panel (achievements, challenges, cosmetics).
--
-- Additive and backward compatible: no column is dropped or renamed, every
-- existing row stays active, the old API keeps working.
--   * achievements gain is_active / created_at / updated_at; challenges and
--     cosmetics gain updated_at (they already have is_active).
--   * accept_match_score awards achievements from achievements.condition
--     ({"type": "matches_played" | "wins", "count": n}) instead of three
--     hard-coded codes, and only while the achievement is active. The three
--     seeded achievements carry exactly those conditions, so today's behaviour
--     is unchanged.
--   * purchase_cosmetic refuses an inactive cosmetic with its own
--     COSMETIC_INACTIVE error (it used to say COSMETIC_NOT_FOUND).
--   * players keep being able to read the inactive items they own or have
--     progress on, even straight from the browser with their own token.
--   * the public bucket catalog-assets for catalog images (written by the API
--     only).
-- Deactivating never deletes or edits what players own: user_achievements,
-- user_challenges and user_cosmetics rows are untouched.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.achievements add column if not exists is_active boolean not null default true;
alter table public.achievements add column if not exists created_at timestamptz not null default now();
alter table public.achievements add column if not exists updated_at timestamptz not null default now();
alter table public.challenges add column if not exists updated_at timestamptz not null default now();
alter table public.cosmetics add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.achievements;
create trigger set_updated_at before update on public.achievements
  for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at on public.challenges;
create trigger set_updated_at before update on public.challenges
  for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at on public.cosmetics;
create trigger set_updated_at before update on public.cosmetics
  for each row execute function public.update_updated_at();

-- Non-negative amounts. NOT VALID: enforced for new and updated rows without
-- scanning (and without failing on) rows written before the constraint.
do $$ begin
  alter table public.achievements
    add constraint achievements_points_check check (points >= 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.challenges
    add constraint challenges_reward_xp_check check (reward_xp >= 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.challenges
    add constraint challenges_reward_currency_check check (reward_currency >= 0) not valid;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- RLS: a player keeps reading the inactive items they own / have progress on.
-- (The public policies only show active rows; these are additive.)
-- ---------------------------------------------------------------------------
drop policy if exists "cosmetics_owner_read" on public.cosmetics;
create policy "cosmetics_owner_read" on public.cosmetics
  for select to authenticated
  using (exists (
    select 1 from public.user_cosmetics uc
    where uc.cosmetic_id = cosmetics.id and uc.user_id = (select auth.uid())
  ));

drop policy if exists "challenges_participant_read" on public.challenges;
create policy "challenges_participant_read" on public.challenges
  for select to authenticated
  using (exists (
    select 1 from public.user_challenges ucg
    where ucg.challenge_id = challenges.id and ucg.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- accept_match_score: achievements driven by achievements.condition and
-- is_active. Same body as before otherwise (card #21/#54/#61/#62).
-- ---------------------------------------------------------------------------
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

    -- Card #54 / #78: award every active achievement whose condition the
    -- just-updated counter-cache meets. Supported condition types:
    -- matches_played (user_stats.total_matches) and wins (user_stats.wins),
    -- both with "count". Idempotent: unique (user_id, achievement_id).
    select * into v_stats from user_stats where user_id = mp.user_id;
    if found then
      insert into user_achievements (user_id, achievement_id)
      select mp.user_id, a.id
      from achievements a
      where a.is_active
        and a.condition ->> 'count' ~ '^[0-9]{1,9}$'
        and (
          (a.condition ->> 'type' = 'matches_played'
            and v_stats.total_matches >= (a.condition ->> 'count')::integer)
          or
          (a.condition ->> 'type' = 'wins'
            and v_stats.wins >= (a.condition ->> 'count')::integer)
        )
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

-- ---------------------------------------------------------------------------
-- purchase_cosmetic: an inactive cosmetic is refused with COSMETIC_INACTIVE.
-- A missing one is still COSMETIC_NOT_FOUND; an owned one ALREADY_OWNED.
-- ---------------------------------------------------------------------------
create or replace function public.purchase_cosmetic(p_user_id uuid, p_cosmetic_id uuid)
returns user_cosmetics
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_balance integer;
  v_price integer;
  v_active boolean;
  v_already_owned boolean;
  v_result user_cosmetics;
begin
  select points_balance into v_balance from users where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  select price_currency, is_active into v_price, v_active from cosmetics where id = p_cosmetic_id;
  if not found then
    raise exception 'COSMETIC_NOT_FOUND';
  end if;

  select exists(select 1 from user_cosmetics where user_id = p_user_id and cosmetic_id = p_cosmetic_id) into v_already_owned;
  if v_already_owned then
    raise exception 'ALREADY_OWNED';
  end if;

  if not v_active then
    raise exception 'COSMETIC_INACTIVE';
  end if;

  if v_balance < v_price then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update users set points_balance = points_balance - v_price, updated_at = now() where id = p_user_id;

  insert into points_transactions (user_id, delta, reason, metadata)
  values (p_user_id, -v_price, 'cosmetic_purchase', jsonb_build_object('cosmetic_id', p_cosmetic_id));

  insert into user_cosmetics (user_id, cosmetic_id) values (p_user_id, p_cosmetic_id)
  returning * into v_result;

  return v_result;
end;
$$;

-- CREATE OR REPLACE keeps the existing ACLs (service_role only); restated so
-- the file is self-contained when replayed.
revoke all on function public.accept_match_score(uuid, smallint, boolean) from public, anon, authenticated;
revoke all on function public.purchase_cosmetic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_cosmetic(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Public bucket for catalog images (cosmetic art, achievement icons). Files go
-- to <uuid>.<ext>; writes only through the API (service_role bypasses storage
-- RLS, there is no write policy for anyone else). Reads are by public URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-assets', 'catalog-assets', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
