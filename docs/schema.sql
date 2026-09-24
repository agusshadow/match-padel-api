-- ============================================================
-- Match Padel — Schema inicial Supabase
-- ============================================================
-- Ejecutar en Supabase SQL Editor (Settings → SQL Editor)
-- Orden: extensions → enums → tablas → índices → RLS → functions
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

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
create type tournament_format as enum ('round_robin', 'single_elimination', 'double_elimination', 'americano');
create type tournament_status as enum ('draft', 'open', 'in_progress', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
create type notification_type as enum ('match_invite', 'score_submitted', 'tournament_update', 'reservation_reminder', 'system');

-- ============================================================
-- TABLAS CORE
-- ============================================================

-- users: extiende auth.users de Supabase
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text not null,
  avatar_url    text,
  phone         text,
  elo           integer not null default 1000,
  role          user_role not null default 'player',
  is_active     boolean not null default true,
  fcm_token     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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
  is_active     boolean not null default true,
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- club_staff: relación many-to-many usuarios ↔ clubs
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

-- court_schedule: disponibilidad horaria por cancha
create table public.court_schedules (
  id            uuid primary key default uuid_generate_v4(),
  court_id      uuid not null references courts(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0=domingo
  open_time     time not null,
  close_time    time not null,
  slot_minutes  smallint not null default 90,
  is_active     boolean not null default true
);

-- court_reservations (Supabase Realtime activo aquí)
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
  mp_event_id     text unique,         -- idempotencia de webhooks
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- matches
create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  club_id         uuid references clubs(id),
  reservation_id  uuid references court_reservations(id),
  tournament_id   uuid,                -- FK se agrega luego (circular)
  type            match_type not null default 'friendly',
  status          match_status not null default 'waiting',
  score_team1     integer[] default '{}',   -- [6,4,7] sets ganados por juego
  score_team2     integer[] default '{}',
  score_status    score_status not null default 'pending',
  winner_team     smallint check (winner_team in (1, 2)),
  is_ranked       boolean not null default false,
  lobby_url       text,               -- UUID aleatorio para invitar
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- match_players: 4 jugadores por partido
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
  bracket       jsonb not null default '{}',  -- estructura del bracket
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- FK circular tournaments ↔ matches
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

-- elo_history: historial de cambios de ELO
create table public.elo_history (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  match_id    uuid not null references matches(id),
  elo_before  integer not null,
  elo_after   integer not null,
  delta       integer not null,
  created_at  timestamptz not null default now()
);

-- achievements (catálogo)
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

-- points_transactions: tienda de puntos
create table public.points_transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  delta       integer not null,         -- positivo o negativo
  reason      text not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
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
-- ÍNDICES
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

-- ============================================================
-- SUPABASE REALTIME (solo court_reservations)
-- ============================================================
alter publication supabase_realtime add table court_reservations;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Nota: el API usa service_role (bypass RLS).
-- RLS protege el acceso directo al frontend via anon key.

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

-- Políticas básicas de acceso desde el frontend (anon key)

-- users: cualquiera puede ver perfiles públicos
create policy "users_public_read" on users for select using (true);
create policy "users_own_update" on users for update using (auth.uid() = id);

-- clubs: lectura pública
create policy "clubs_public_read" on clubs for select using (is_active = true);

-- courts: lectura pública
create policy "courts_public_read" on courts for select using (is_active = true);

-- court_schedules: lectura pública
create policy "schedules_public_read" on court_schedules for select using (is_active = true);

-- court_reservations: usuario ve las propias
create policy "reservations_own_read" on court_reservations for select using (auth.uid() = user_id);

-- matches: jugadores ven partidos en los que participan
create policy "matches_participants_read" on matches for select using (
  exists (select 1 from match_players where match_id = id and user_id = auth.uid())
  or created_by = auth.uid()
);

-- match_chats: idem
create policy "chats_participants_read" on match_chats for select using (
  exists (select 1 from match_players where match_id = match_chats.match_id and user_id = auth.uid())
);

-- tournaments: lectura pública
create policy "tournaments_public_read" on tournaments for select using (status <> 'draft');

-- tournament_teams: lectura pública
create policy "tournament_teams_public_read" on tournament_teams for select using (true);

-- achievements: catálogo público
create policy "achievements_public_read" on achievements for select using (true);

-- user_achievements: públicas
create policy "user_achievements_public_read" on user_achievements for select using (true);

-- elo_history: público
create policy "elo_history_public_read" on elo_history for select using (true);

-- notifications: solo el dueño
create policy "notifications_own_read" on notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on notifications for update using (auth.uid() = user_id);

-- payments: solo el dueño
create policy "payments_own_read" on payments for select using (auth.uid() = user_id);

-- points_transactions: solo el dueño
create policy "points_own_read" on points_transactions for select using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: updated_at automático
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
-- TRIGGER: crear perfil de usuario al registrarse
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, full_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

