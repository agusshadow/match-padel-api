-- Card #56: getMyStats currently recomputes total_matches/wins/losses from
-- match_players+matches on every request. This adds a counter-cache table
-- kept up to date by a trigger when a match transitions to 'completed', so
-- the profile reads one indexed row instead of scanning/joining every time.

create table public.user_stats (
  user_id       uuid primary key references users(id) on delete cascade,
  total_matches integer not null default 0,
  wins          integer not null default 0,
  losses        integer not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.user_stats enable row level security;
create policy "user_stats_public_read" on public.user_stats for select using (true);

create or replace function public.update_user_stats_on_match_completed()
returns trigger language plpgsql as $$
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
$$;

create trigger trg_update_user_stats
after update on public.matches
for each row execute function public.update_user_stats_on_match_completed();

-- Backfill from existing completed matches so current users don't show zeros.
insert into public.user_stats (user_id, total_matches, wins, losses, updated_at)
select
  mp.user_id,
  count(*) as total_matches,
  count(*) filter (where mp.team = m.winner_team) as wins,
  count(*) filter (where mp.team <> m.winner_team) as losses,
  now()
from match_players mp
join matches m on m.id = mp.match_id
where m.status = 'completed' and m.winner_team is not null
group by mp.user_id
on conflict (user_id) do update set
  total_matches = excluded.total_matches,
  wins = excluded.wins,
  losses = excluded.losses,
  updated_at = now();