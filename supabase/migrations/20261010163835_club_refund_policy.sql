-- Card #76 [Admin F3]: refund policy per club within platform limits, and the data
-- to track refunds that are partial or could not be completed.
--
-- Additive and backward compatible: only new columns (with defaults), one new
-- table and one backfill of rows that are already refunded. The API that is in
-- production keeps working: it never reads or writes the new columns.
--
-- Semantics (decided by the product owner)
--   A club defines when a player may cancel with a full refund and what share
--   comes back when the player cancels later:
--     clubs.refund_hours_before_start : cutoff, in hours before the start.
--                                       Cancelling AT LEAST that long before the
--                                       start refunds 100% of what the player paid.
--     clubs.refund_late_percent       : share of what the player paid that comes
--                                       back in MONEY when the cancellation is
--                                       inside the cutoff window (and the match
--                                       has not started). After the start: 0.
--   Defaults reproduce today's behaviour for every existing club: 24 hours, and
--   0% late refund (no real money back that late). The one behaviour change the
--   API makes with these defaults is that a late cancellation no longer credits
--   internal currency (the credit was card #63; it is removed by this card).
--
--   platform_settings.refund_policy_minimums holds the platform limits that
--   protect players: a club's cutoff may not exceed `max_hours_before_start`
--   and its late refund may not be below `min_late_refund_percent`. The API
--   validates a club's policy against them when it is saved and clamps a stored
--   policy that violates newer limits at evaluation time (never rewrites it).
--
--   payments.refund_status / refunded_amount / refund_error: how much of a
--   payment went back and, when a refund could not be completed (club account
--   without balance or link, Mercado Pago rejection), the pending state the
--   club has to resolve. NULL refund_status = never processed by the policy.

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
alter table public.clubs
  add column if not exists refund_hours_before_start smallint not null default 24
    constraint clubs_refund_hours_before_start_check check (refund_hours_before_start >= 0 and refund_hours_before_start <= 720),
  add column if not exists refund_late_percent numeric(5,2) not null default 0
    constraint clubs_refund_late_percent_check check (refund_late_percent >= 0 and refund_late_percent <= 100);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists refund_status text
    constraint payments_refund_status_check check (refund_status is null or refund_status in ('none', 'partial', 'full', 'pending', 'failed')),
  add column if not exists refunded_amount numeric(10,2) not null default 0
    constraint payments_refunded_amount_check check (refunded_amount >= 0),
  add column if not exists refund_error text;

-- Payments the API already refunded in full before this card: record it.
update public.payments
   set refund_status = 'full',
       refunded_amount = amount
 where status = 'refunded'
   and refund_status is null;

-- ---------------------------------------------------------------------------
-- platform_settings: key/value settings of the platform (superadmin only)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- RLS posture: enabled, no policies and no client grants: only the API
-- (service role) reads or writes it.
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;

insert into public.platform_settings (key, value)
values ('refund_policy_minimums', '{"max_hours_before_start": 48, "min_late_refund_percent": 0}'::jsonb)
on conflict (key) do nothing;
