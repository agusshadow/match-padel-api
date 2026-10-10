-- Card #69 [Admin F1]: transactional email log.
--
-- Additive and backward compatible: a new table that nothing in production
-- reads or writes. The API records one row per send attempt (sent, failed or
-- skipped when the mail mode is "log" or no template applies).

create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  to_email     text not null,
  template     text not null,
  club_id      uuid references public.clubs(id) on delete set null,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists email_log_club_created_idx
  on public.email_log (club_id, created_at desc);
create index if not exists email_log_created_idx
  on public.email_log (created_at desc);

alter table public.email_log enable row level security;
-- No policies on purpose: only service_role (the API) reads or writes it.
revoke all on table public.email_log from anon, authenticated;
