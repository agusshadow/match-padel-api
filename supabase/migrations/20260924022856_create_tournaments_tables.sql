
-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  club_id         UUID REFERENCES clubs(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  format          TEXT NOT NULL DEFAULT 'round_robin', -- round_robin | elimination
  status          TEXT NOT NULL DEFAULT 'open',        -- open | in_progress | completed | cancelled
  max_teams       INTEGER NOT NULL DEFAULT 8,
  min_elo         INTEGER,
  max_elo         INTEGER,
  prize_info      TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournament teams (pairs of players)
CREATE TABLE IF NOT EXISTS tournament_teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id      UUID NOT NULL REFERENCES users(id),
  player2_id      UUID NOT NULL REFERENCES users(id),
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'active', -- active | withdrawn
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player1_id),
  UNIQUE (tournament_id, player2_id)
);

-- Tournament matches (linked to existing matches table or standalone)
CREATE TABLE IF NOT EXISTS tournament_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id) ON DELETE SET NULL,
  team1_id        UUID REFERENCES tournament_teams(id),
  team2_id        UUID REFERENCES tournament_teams(id),
  winner_team_id  UUID REFERENCES tournament_teams(id),
  round           INTEGER NOT NULL DEFAULT 1,
  scheduled_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  score_team1     INTEGER[],
  score_team2     INTEGER[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_start_date_idx ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS tournament_teams_tournament_id_idx ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_matches_tournament_id_idx ON tournament_matches(tournament_id);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Tournaments: public read
DROP POLICY IF EXISTS "tournaments_public_read" ON tournaments;
CREATE POLICY "tournaments_public_read" ON tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournaments_auth_insert" ON tournaments;
CREATE POLICY "tournaments_auth_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tournaments_creator_update" ON tournaments;
CREATE POLICY "tournaments_creator_update" ON tournaments FOR UPDATE
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Tournament teams: public read
DROP POLICY IF EXISTS "tournament_teams_public_read" ON tournament_teams;
CREATE POLICY "tournament_teams_public_read" ON tournament_teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_teams_auth_insert" ON tournament_teams;
CREATE POLICY "tournament_teams_auth_insert" ON tournament_teams FOR INSERT
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "tournament_teams_player_delete" ON tournament_teams;
CREATE POLICY "tournament_teams_player_delete" ON tournament_teams FOR DELETE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Tournament matches: public read
DROP POLICY IF EXISTS "tournament_matches_public_read" ON tournament_matches;
CREATE POLICY "tournament_matches_public_read" ON tournament_matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_matches_service_write" ON tournament_matches;
CREATE POLICY "tournament_matches_service_write" ON tournament_matches FOR ALL WITH CHECK (true);
