-- Card #72 [Admin F2]: club team. A club owner invites people by email to be
-- Administrador (`admin`) or Recepcion (`staff`) of the club.
--
-- Additive and backward compatible: one new table and one RPC. The API in
-- production does not know about invitations and keeps working. `staff_role`
-- is not changed. The `owner` role is deliberately NOT invitable (a club has
-- its owner from the application; ownership transfer is out of scope).
--
-- Model
--   club_invitations : one row per invitation. Only a SHA-256 hash of the token
--                      is stored; the raw token travels once, in the email link.
--   Only one pending invitation per (club, email) (partial unique index).
--   Written and read by the API only (service role): RLS enabled, no policies.
--   accept_club_invitation : marks the invitation accepted and creates the
--                      membership in ONE transaction (service_role only).

-- ---------------------------------------------------------------------------
-- club_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.club_invitations (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  email        text not null,
  role         public.staff_role not null,
  token_hash   text not null,
  invited_by   uuid references public.users(id) on delete set null,
  status       text not null default 'pending',
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_by  uuid references public.users(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint club_invitations_token_hash_key unique (token_hash),
  constraint club_invitations_role_check check (role in ('admin', 'staff')),
  constraint club_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint club_invitations_email_check
    check (email = lower(email) and length(email) between 3 and 254)
);

-- One pending invitation per club and email.
create unique index if not exists club_invitations_pending_email_key
  on public.club_invitations (club_id, lower(email))
  where status = 'pending';

create index if not exists club_invitations_club_idx on public.club_invitations (club_id, created_at desc);
create index if not exists club_invitations_invited_by_idx on public.club_invitations (invited_by);
create index if not exists club_invitations_accepted_by_idx on public.club_invitations (accepted_by);

-- ---------------------------------------------------------------------------
-- RLS: API only (service role bypasses it). No policies, no client grants.
-- ---------------------------------------------------------------------------
alter table public.club_invitations enable row level security;
revoke all on table public.club_invitations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_club_invitation(invitation, user)
--
-- Compare-and-set: only a pending, unexpired invitation is accepted, so two
-- concurrent accepts cannot both win. The membership is created with
-- `on conflict do nothing`: a user who is already a member (including the
-- owner) keeps the role they have, never downgraded or changed. Returns one
-- row (club_id, role, already_member) or no row when the invitation is not
-- acceptable any more.
-- ---------------------------------------------------------------------------
create or replace function public.accept_club_invitation(
  p_invitation_id uuid,
  p_user_id       uuid
)
returns table (club_id uuid, role public.staff_role, already_member boolean)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_club_id  uuid;
  v_role     public.staff_role;
  v_inserted boolean;
begin
  update public.club_invitations i
     set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
   where i.id = p_invitation_id
     and i.status = 'pending'
     and i.expires_at > now()
  returning i.club_id, i.role into v_club_id, v_role;

  if not found then
    return;
  end if;

  insert into public.club_staff (club_id, user_id, role)
  values (v_club_id, p_user_id, v_role)
  on conflict (club_id, user_id) do nothing;
  v_inserted := found;

  select s.role into v_role
    from public.club_staff s
   where s.club_id = v_club_id and s.user_id = p_user_id;

  return query select v_club_id, v_role, not v_inserted;
end;
$$;

revoke execute on function public.accept_club_invitation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_club_invitation(uuid, uuid) to service_role;
