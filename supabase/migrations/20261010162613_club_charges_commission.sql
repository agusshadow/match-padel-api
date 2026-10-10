-- Card #75 [Admin F3]: charges with a commission per club, collected by the club's
-- own Mercado Pago account, and the data to settle webhooks per seller.
--
-- Additive and backward compatible: only new columns (with defaults), one new
-- policy and one new function. The API that is in production keeps working:
--   * it never writes the new columns, so the defaults apply: `collected_via`
--     is 'platform' (it always charged with the platform token), the fee
--     columns stay null;
--   * every existing club is backfilled to `collection_mode = 'platform_account'`,
--     which is exactly today's behaviour (charges go to the platform's token).
--
-- Model
--   clubs.commission_percent : the platform's commission on each charge of the
--                              club, 0..100 with 2 decimals. The DEFAULT 0 is
--                              deliberate: the superadmin sets each club's rate
--                              explicitly (PATCH /platform/clubs/:clubId/commission);
--                              a club never pays a commission nobody chose.
--   clubs.collection_mode    : 'platform_account' (charges go to the platform's
--                              Mercado Pago account, no marketplace fee: what
--                              every existing club does) or 'club_account'
--                              (charges go to the club's own linked account and
--                              carry the commission as marketplace_fee).
--                              Existing clubs are backfilled to
--                              'platform_account'; the DEFAULT for NEW clubs is
--                              'club_account'.
--   payments                 : which club the charge belongs to, which account
--                              collected it and the commission applied, frozen
--                              at charge time (a later change of the club's
--                              rate never rewrites a payment).

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
alter table public.clubs
  add column if not exists commission_percent numeric(5,2) not null default 0
    constraint clubs_commission_percent_check check (commission_percent >= 0 and commission_percent <= 100);

-- Added with 'platform_account' as the default so every EXISTING row is
-- backfilled to it; the default is then switched for the clubs created from now on.
alter table public.clubs
  add column if not exists collection_mode text not null default 'platform_account'
    constraint clubs_collection_mode_check check (collection_mode in ('platform_account', 'club_account'));

alter table public.clubs alter column collection_mode set default 'club_account';

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists seller_mp_user_id text,
  add column if not exists commission_percent numeric(5,2)
    constraint payments_commission_percent_check check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100)),
  add column if not exists marketplace_fee numeric(10,2)
    constraint payments_marketplace_fee_check check (marketplace_fee is null or marketplace_fee >= 0),
  add column if not exists net_amount numeric(10,2),
  add column if not exists collected_via text not null default 'platform'
    constraint payments_collected_via_check check (collected_via in ('platform', 'club'));

-- Backfill the club of every existing payment from its reservation. Rows without
-- a reservation (none today) keep a null club_id. Every existing payment was
-- collected through the platform's token, which is the column default.
update public.payments p
   set club_id = coalesce(r.club_id, c.club_id)
  from public.court_reservations r
  left join public.courts c on c.id = r.court_id
 where p.reservation_id = r.id
   and p.club_id is null;

create index if not exists payments_club_created_idx on public.payments (club_id, created_at desc);

-- RLS posture: the table already has RLS and the owner-read policy
-- (payments_own_read). Members of the club (and platform superadmins, through
-- the helper) can also read the club's payments; nobody writes from the client
-- (no insert/update/delete policy, as before).
drop policy if exists "payments_club_read" on public.payments;
create policy "payments_club_read" on public.payments
  for select to authenticated
  using (club_id is not null and public.is_club_member(club_id));

-- ---------------------------------------------------------------------------
-- Totals for the payments listings (platform and club panels)
-- ---------------------------------------------------------------------------
-- Only approved payments count (money actually collected). `fee` is the
-- marketplace fee (the platform's commission); `net` is what is left for the
-- seller before Mercado Pago's own processing fee. Rows written before this
-- migration (null fee/net) count as fee 0 and net = amount.
create or replace function public.payment_totals(
  p_club_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (gross numeric, fee numeric, net numeric, payments bigint)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(p.amount), 0)::numeric,
    coalesce(sum(coalesce(p.marketplace_fee, 0)), 0)::numeric,
    coalesce(sum(coalesce(p.net_amount, p.amount - coalesce(p.marketplace_fee, 0))), 0)::numeric,
    count(*)::bigint
  from public.payments p
  where p.status = 'approved'
    and (p_club_id is null or p.club_id = p_club_id)
    and (p_from is null or p.created_at >= p_from)
    and (p_to is null or p.created_at < p_to);
$$;

revoke all on function public.payment_totals(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.payment_totals(uuid, timestamptz, timestamptz) to service_role;
