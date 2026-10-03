
-- Fix matches RLS policy (bug: match_players.id should be matches.id)
DROP POLICY IF EXISTS "matches_participants_read" ON public.matches;
DROP POLICY IF EXISTS "matches_public_read" ON public.matches;
DROP POLICY IF EXISTS "matches_own_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_own_update" ON public.matches;
DROP POLICY IF EXISTS "match_players_read" ON public.match_players;
DROP POLICY IF EXISTS "match_players_public_read" ON public.match_players;
DROP POLICY IF EXISTS "match_players_own_insert" ON public.match_players;
DROP POLICY IF EXISTS "reservations_own_insert" ON public.court_reservations;
DROP POLICY IF EXISTS "reservations_own_update" ON public.court_reservations;
DROP POLICY IF EXISTS "notifications_service_insert" ON public.notifications;

-- Matches: anyone authenticated can read, creator can write
CREATE POLICY "matches_public_read" ON public.matches
  FOR SELECT USING (true);

CREATE POLICY "matches_own_insert" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "matches_own_update" ON public.matches
  FOR UPDATE USING (auth.uid() = created_by);

-- Match players
CREATE POLICY "match_players_public_read" ON public.match_players
  FOR SELECT USING (true);

CREATE POLICY "match_players_own_insert" ON public.match_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Court reservations write
CREATE POLICY "reservations_own_insert" ON public.court_reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reservations_own_update" ON public.court_reservations
  FOR UPDATE USING (auth.uid() = user_id);

-- Notifications insert (via service_role bypasses RLS, but for direct client:)
CREATE POLICY "notifications_service_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);
