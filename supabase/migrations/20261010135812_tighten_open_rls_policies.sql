-- Card #65: close the RLS policies that were open to anyone holding the anon key.
--
-- The API talks to Postgres with service_role, which bypasses RLS, so none of
-- the write policies dropped here are needed by it. The player app never
-- touches tables directly (it only uses the API). The admin panel does read
-- tables directly as a signed-in staff user, so reads that it relies on are
-- kept for staff (users.role in club_staff / super_admin) instead of staying
-- open to everyone.
--
-- Additive in effect for the running code: nothing that the API or the apps
-- use today stops working. What stops working is writing to the business
-- tables, or reading other people's matches, straight from the client.

-- notifications: only the API creates them (it bypasses RLS).
drop policy if exists "notifications_service_insert" on public.notifications;
drop policy if exists "service_role_insert_notifications" on public.notifications;

-- tournament_matches: the write policy was FOR ALL to public with check (true).
-- Public read stays (brackets are meant to be visible).
drop policy if exists "tournament_matches_service_write" on public.tournament_matches;

-- tournaments: no direct client writes; drafts are visible to their creator
-- and to staff only.
drop policy if exists "tournaments_auth_insert" on public.tournaments;
drop policy if exists "tournaments_creator_update" on public.tournaments;
drop policy if exists "tournaments_public_read" on public.tournaments;
create policy "tournaments_read" on public.tournaments for select using (
  status <> 'draft'
  or created_by = auth.uid()
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('club_staff', 'super_admin'))
);

-- tournament_teams: no direct client writes. Public read stays.
drop policy if exists "tournament_teams_auth_insert" on public.tournament_teams;
drop policy if exists "tournament_teams_player_delete" on public.tournament_teams;

-- matches: no direct client writes (they skipped capacity, payment and score
-- rules, and could mark a match completed). Reads: the creator, the players of
-- the match, and staff. lobby_url is no longer readable by everyone.
drop policy if exists "matches_own_insert" on public.matches;
drop policy if exists "matches_own_update" on public.matches;
drop policy if exists "matches_public_read" on public.matches;
create policy "matches_participants_or_staff_read" on public.matches for select using (
  created_by = auth.uid()
  or exists (select 1 from public.match_players mp where mp.match_id = matches.id and mp.user_id = auth.uid())
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('club_staff', 'super_admin'))
);

-- match_players: no direct inserts (they skipped capacity and payment). A
-- player sees their own rows, staff see all. The policy does not reference
-- matches, so there is no policy recursion with the one above.
drop policy if exists "match_players_own_insert" on public.match_players;
drop policy if exists "match_players_public_read" on public.match_players;
create policy "match_players_own_or_staff_read" on public.match_players for select using (
  user_id = auth.uid()
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('club_staff', 'super_admin'))
);

-- court_reservations: no direct inserts or updates (they skipped price and
-- payment: a confirmed reservation at price 0). Reads: the owner and staff.
drop policy if exists "reservations_own_insert" on public.court_reservations;
drop policy if exists "reservations_own_update" on public.court_reservations;
drop policy if exists "reservations_own_read" on public.court_reservations;
create policy "reservations_own_or_staff_read" on public.court_reservations for select using (
  user_id = auth.uid()
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('club_staff', 'super_admin'))
);
