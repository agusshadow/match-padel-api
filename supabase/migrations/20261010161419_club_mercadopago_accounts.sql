-- Card #74 [Admin F3]: Mercado Pago account of each club (OAuth link).
--
-- Additive and backward compatible: two new tables, nothing existing changes.
-- The API in production does not know about them and keeps working.
--
-- Model
--   club_mp_accounts : one row per club with the seller's Mercado Pago tokens.
--                      Tokens are stored ENCRYPTED by the API (AES-256-GCM,
--                      versioned `v1:` prefix); the key lives only in the API's
--                      environment (MP_TOKEN_ENCRYPTION_KEY), never in the DB.
--   mp_oauth_states  : single-use anti-CSRF `state` of the OAuth round trip.
--                      Only the SHA-256 of the state is stored. Valid 10 min.
--
-- Both tables are written and read by the API only (service role): RLS is
-- enabled with NO policies and every client grant is revoked, so the tokens can
-- never be read through PostgREST with the anon or an authenticated key.

-- ---------------------------------------------------------------------------
-- club_mp_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.club_mp_accounts (
  club_id           uuid primary key references public.clubs(id) on delete cascade,
  mp_user_id        text not null,
  access_token_enc  text not null,
  refresh_token_enc text not null,
  public_key        text,
  scope             text,
  expires_at        timestamptz not null,
  live_mode         boolean,
  status            text not null default 'connected',
  last_refresh_at   timestamptz,
  last_error        text,
  last_notified_at  timestamptz,
  connected_by      uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint club_mp_accounts_status_check
    check (status in ('connected', 'expiring', 'expired', 'revoked', 'error'))
);

create index if not exists club_mp_accounts_expires_idx on public.club_mp_accounts (expires_at);
create index if not exists club_mp_accounts_connected_by_idx on public.club_mp_accounts (connected_by);

drop trigger if exists set_updated_at on public.club_mp_accounts;
create trigger set_updated_at
  before update on public.club_mp_accounts
  for each row execute function public.update_updated_at();

alter table public.club_mp_accounts enable row level security;
revoke all on table public.club_mp_accounts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- mp_oauth_states
-- ---------------------------------------------------------------------------
create table if not exists public.mp_oauth_states (
  state_hash        text primary key,
  club_id           uuid not null references public.clubs(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  -- PKCE code_verifier, encrypted like the tokens; null when PKCE is not used.
  code_verifier_enc text,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '10 minutes'),
  used_at           timestamptz
);

create index if not exists mp_oauth_states_club_idx on public.mp_oauth_states (club_id);
create index if not exists mp_oauth_states_user_idx on public.mp_oauth_states (user_id);
create index if not exists mp_oauth_states_expires_idx on public.mp_oauth_states (expires_at);

alter table public.mp_oauth_states enable row level security;
revoke all on table public.mp_oauth_states from public, anon, authenticated;
