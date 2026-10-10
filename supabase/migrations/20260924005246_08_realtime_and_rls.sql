
-- Realtime solo para court_reservations
alter publication supabase_realtime add table court_reservations;

-- RLS en todas las tablas
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
create policy "users_public_read" on users for select using (true);
create policy "users_own_update" on users for update using (auth.uid() = id);

create policy "clubs_public_read" on clubs for select using (is_active = true);
create policy "courts_public_read" on courts for select using (is_active = true);
create policy "schedules_public_read" on court_schedules for select using (is_active = true);

create policy "reservations_own_read" on court_reservations for select using (auth.uid() = user_id);

create policy "matches_participants_read" on matches for select using (
  exists (select 1 from match_players where match_id = id and user_id = auth.uid())
  or created_by = auth.uid()
);

create policy "chats_participants_read" on match_chats for select using (
  exists (select 1 from match_players where match_id = match_chats.match_id and user_id = auth.uid())
);

create policy "tournaments_public_read" on tournaments for select using (status <> 'draft');
create policy "tournament_teams_public_read" on tournament_teams for select using (true);
create policy "achievements_public_read" on achievements for select using (true);
create policy "user_achievements_public_read" on user_achievements for select using (true);
create policy "elo_history_public_read" on elo_history for select using (true);

create policy "notifications_own_read" on notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on notifications for update using (auth.uid() = user_id);

create policy "payments_own_read" on payments for select using (auth.uid() = user_id);
create policy "points_own_read" on points_transactions for select using (auth.uid() = user_id);
