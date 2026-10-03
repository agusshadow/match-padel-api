
-- matches (sin FK a tournaments todavía — circular)
create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  club_id         uuid references clubs(id),
  reservation_id  uuid references court_reservations(id),
  tournament_id   uuid,
  type            match_type not null default 'friendly',
  status          match_status not null default 'waiting',
  score_team1     integer[] default '{}',
  score_team2     integer[] default '{}',
  score_status    score_status not null default 'pending',
  winner_team     smallint check (winner_team in (1, 2)),
  is_ranked       boolean not null default false,
  lobby_url       text,
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- match_players
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
