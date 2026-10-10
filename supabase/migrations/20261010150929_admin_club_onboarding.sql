-- Card #67 [Admin F1]: club lifecycle state, application data and private
-- document storage for the club onboarding.
--
-- Additive and backward compatible: nothing is dropped or renamed. Existing
-- clubs are backfilled to 'approved' so they stay visible. The code in
-- production ignores the new column and keeps working; the new API filters
-- public club reads by status.
--
-- Note on the column default: the column is added with default 'approved' (so
-- every existing row becomes approved) and then switched to 'draft' for new
-- rows. Until the new API is released, a club inserted by the old
-- POST /platform/clubs therefore becomes 'draft'; the old API does not filter
-- by status, so it keeps showing it. The new API inserts it as 'approved'.

-- ---------------------------------------------------------------------------
-- Lifecycle state
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.club_status as enum
    ('draft', 'pending', 'changes_requested', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

alter table public.clubs
  add column if not exists status public.club_status not null default 'approved';

alter table public.clubs
  alter column status set default 'draft';

create index if not exists clubs_status_idx on public.clubs (status);

-- ---------------------------------------------------------------------------
-- Application data. Opening hours live in clubs.settings->'opening_hours'
-- (weekly draft: { "mon": [{ "open": "08:00", "close": "23:00" }], ... });
-- F2 replaces it with a proper schedule model.
-- ---------------------------------------------------------------------------
alter table public.clubs add column if not exists legal_name text;
alter table public.clubs add column if not exists tax_id text;

-- ---------------------------------------------------------------------------
-- Status history (written by the API on every status change)
-- ---------------------------------------------------------------------------
create table if not exists public.club_status_history (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  from_status  public.club_status,
  to_status    public.club_status not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists club_status_history_club_created_idx
  on public.club_status_history (club_id, created_at desc);

alter table public.club_status_history enable row level security;
-- No policies on purpose: only service_role (the API) reads or writes it.
revoke all on table public.club_status_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Application documents (metadata; the files live in the private bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.club_documents (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  uploaded_by  uuid references public.users(id) on delete set null,
  kind         text not null
               check (kind in ('tax_id', 'company_registration', 'id_document', 'other')),
  file_path    text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   integer not null,
  created_at   timestamptz not null default now()
);

create index if not exists club_documents_club_idx on public.club_documents (club_id, created_at);

alter table public.club_documents enable row level security;
-- No policies on purpose: only service_role (the API) reads or writes it.
revoke all on table public.club_documents from anon, authenticated;

-- Private bucket; files go to <clubId>/<uuid>-<safe filename>. Writes and
-- signed URLs only through the API (service_role bypasses storage RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-documents', 'club-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: only approved (and active) clubs are public. Staff of the club and
-- platform staff (any platform role) read every state. The staff policy is
-- `to authenticated` because the helpers are not executable by anon.
-- ---------------------------------------------------------------------------
drop policy if exists "clubs_public_read" on public.clubs;
drop policy if exists "clubs_staff_read" on public.clubs;
create policy "clubs_public_read" on public.clubs
  for select to anon, authenticated
  using (status = 'approved' and is_active = true);
create policy "clubs_staff_read" on public.clubs
  for select to authenticated
  using (public.is_club_member(id) or public.is_platform_staff());

-- Courts of a club that is not public must not leak through the anon key.
drop policy if exists "courts_public_read" on public.courts;
drop policy if exists "courts_staff_read" on public.courts;
create policy "courts_public_read" on public.courts
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.clubs c
      where c.id = courts.club_id and c.status = 'approved' and c.is_active = true
    )
  );
create policy "courts_staff_read" on public.courts
  for select to authenticated
  using (public.is_club_member(club_id) or public.is_platform_staff());
