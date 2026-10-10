-- Card #63: in-app currency ("puntos") + cosmetics marketplace. The currency
-- is earned by playing (challenge rewards, card #62) or bought with real
-- money via MercadoPago (hybrid model) — reuses the existing but dormant
-- points_transactions table as the ledger. Rate: 1 currency unit = $5 ARS,
-- fixed by the one top-up pack below (adjustable later).

create type cosmetic_type as enum ('palette_skin', 'avatar', 'emblem');

alter table public.users
  add column points_balance integer not null default 0,
  add column equipped_palette_cosmetic_id uuid,
  add column equipped_avatar_cosmetic_id uuid,
  add column equipped_emblem_cosmetic_id uuid;

comment on column public.users.points_balance is 'Card #63: current internal-currency balance, denormalized from points_transactions for fast reads.';

create table public.cosmetics (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique not null,
  name            text not null,
  description     text not null,
  type            cosmetic_type not null,
  image_url       text not null,
  price_currency  integer not null check (price_currency >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.user_cosmetics (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id),
  cosmetic_id   uuid not null references cosmetics(id),
  acquired_at   timestamptz not null default now(),
  unique (user_id, cosmetic_id)
);

alter table public.users
  add constraint users_equipped_palette_fkey foreign key (equipped_palette_cosmetic_id) references cosmetics(id),
  add constraint users_equipped_avatar_fkey foreign key (equipped_avatar_cosmetic_id) references cosmetics(id),
  add constraint users_equipped_emblem_fkey foreign key (equipped_emblem_cosmetic_id) references cosmetics(id);

-- Real-money top-up purchases of the internal currency. Kept separate from
-- `payments` (which assumes a court_reservations-shaped purchase) rather than
-- overloading that table's semantics; the webhook tells the two apart by an
-- 'currency:' prefix on external_reference (see payment.service.ts).
create table public.currency_purchases (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  amount_ars      numeric(10,2) not null,
  currency_amount integer not null,
  status          payment_status not null default 'pending',
  mp_payment_id   text unique,
  mp_event_id     text unique,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on user_cosmetics(user_id);
create index on currency_purchases(user_id);

alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.currency_purchases enable row level security;

create policy "cosmetics_public_read" on cosmetics for select using (is_active = true);
create policy "user_cosmetics_own_read" on user_cosmetics for select using (user_id = auth.uid());
create policy "currency_purchases_own_read" on currency_purchases for select using (user_id = auth.uid());

-- Seed catalog: one item per type, per the examples given when this was scoped.
insert into cosmetics (code, name, description, type, image_url, price_currency) values
  ('palette_classic_red', 'Paleta Roja Clásica', 'Skin roja para tu paleta', 'palette_skin', 'https://placehold.co/200x200/ef4444/ffffff?text=Paleta', 100),
  ('palette_neon_blue', 'Paleta Azul Neón', 'Skin azul neón para tu paleta', 'palette_skin', 'https://placehold.co/200x200/3b82f6/ffffff?text=Paleta', 150),
  ('avatar_frame_gold', 'Marco Dorado', 'Marco dorado para tu foto de perfil', 'avatar', 'https://placehold.co/200x200/eab308/ffffff?text=Marco', 200),
  ('emblem_fire', 'Emblema de Fuego', 'Emblema de fuego junto a tu nombre', 'emblem', 'https://placehold.co/200x200/f97316/ffffff?text=Emblema', 120)
on conflict (code) do nothing;

-- Card #62 challenges now pay out some currency too, now that it exists.
update challenges set reward_currency = 50 where code = 'weekly_win_3';
update challenges set reward_currency = 100 where code = 'monthly_play_10';

-- Credits currency to a user (positive delta only — negative deltas are
-- spends, handled directly inside purchase_cosmetic's own transaction).
create or replace function credit_currency(p_user_id uuid, p_amount integer, p_reason text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  insert into points_transactions (user_id, delta, reason)
  values (p_user_id, p_amount, p_reason);

  update users set points_balance = points_balance + p_amount, updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function credit_currency(uuid, integer, text) from public, anon, authenticated;
grant execute on function credit_currency(uuid, integer, text) to service_role;

-- Atomic purchase: checks balance and prior ownership, deducts, records the
-- ledger entry and the ownership row together so nothing can go out of sync.
create or replace function purchase_cosmetic(p_user_id uuid, p_cosmetic_id uuid)
returns user_cosmetics
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_balance integer;
  v_price integer;
  v_already_owned boolean;
  v_result user_cosmetics;
begin
  select points_balance into v_balance from users where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  select price_currency into v_price from cosmetics where id = p_cosmetic_id and is_active;
  if not found then
    raise exception 'COSMETIC_NOT_FOUND';
  end if;

  select exists(select 1 from user_cosmetics where user_id = p_user_id and cosmetic_id = p_cosmetic_id) into v_already_owned;
  if v_already_owned then
    raise exception 'ALREADY_OWNED';
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

revoke all on function purchase_cosmetic(uuid, uuid) from public, anon, authenticated;
grant execute on function purchase_cosmetic(uuid, uuid) to service_role;

-- Wire challenge currency rewards into increment_challenge_progress.
create or replace function increment_challenge_progress(p_user_id uuid, p_action challenge_action, p_amount integer default 1)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  uc record;
  v_new_progress integer;
begin
  for uc in
    select ucg.id, ucg.progress, c.target_count, c.reward_xp, c.reward_currency
    from user_challenges ucg
    join challenges c on c.id = ucg.challenge_id
    where ucg.user_id = p_user_id
      and ucg.status = 'active'
      and c.action_type = p_action
      and now() >= ucg.period_start and now() < ucg.period_end
  loop
    v_new_progress := uc.progress + p_amount;

    if v_new_progress >= uc.target_count then
      update user_challenges
      set progress = v_new_progress, status = 'completed', completed_at = now()
      where id = uc.id;

      update users
      set xp = xp + uc.reward_xp,
          level = level_for_xp(xp + uc.reward_xp),
          updated_at = now()
      where id = p_user_id;

      perform credit_currency(p_user_id, uc.reward_currency, 'challenge_completed');
    else
      update user_challenges set progress = v_new_progress where id = uc.id;
    end if;
  end loop;
end;
$$;

revoke all on function increment_challenge_progress(uuid, challenge_action, integer) from public, anon, authenticated;
grant execute on function increment_challenge_progress(uuid, challenge_action, integer) to service_role;
