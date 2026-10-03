---
name: db-migration
description: Steps to change the database schema safely in match-padel-api - apply to the dev project first, save a versioned migration file, update docs/schema.sql, verify RLS and advisors, call out destructive changes explicitly; production is promoted separately at release time.
---

# Database migration

Executed only by the `db-agent` agent.

1. **Project:** apply to **dev** (`vrnonxpxksaruvsvbplt`, `match-padel-dev`). Never to production (`ebdnlrwzhthqflsbdzvu`) — promotion to production is a separate human-approved step at release time (see step 10).
2. Inspect the current state with `list_tables` before changing anything.
3. Write the migration, idempotent where possible, with a descriptive name.
4. New table: **RLS enabled + policies**. Required extensions declared (`btree_gist`, `uuid-ossp`, etc.).
5. Apply with `apply_migration` against `vrnonxpxksaruvsvbplt`.
6. Run `get_advisors` (security) and resolve the warnings.
7. Update `docs/schema.sql` so it reproduces the entire schema from scratch — it stays the human-readable source of truth.
8. **Also save the same SQL as a versioned file** (card #26): `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, one file per `apply_migration` call, same order they were applied in. The version in the file name must equal the version recorded for that migration in the project's `supabase_migrations.schema_migrations` (check with `list_migrations`), and the contents must be byte-identical to what was applied. `supabase/migrations/` holds exactly the 35 migrations recorded in production from 24/09 to 30/09/2026 (same versions, names and SQL, exported on 03/10/2026), plus any added after; replaying them on an empty project produces a schema identical to production (verified on 03/10/2026). Never edit a file that was already applied anywhere, only add new ones, and never re-run them against a project that already has them.
9. If types consumed by the frontend change, flag it so they get regenerated (`packages/types` in `match-padel-web`).
10. **Promotion to production:** when the release that depends on the change ships, the human (or a session they explicitly direct) replays the migration files that production doesn't have yet, in order, on `ebdnlrwzhthqflsbdzvu`, then runs `get_advisors`. Agents don't do this on their own.
11. **Destructive changes** (`drop`, `truncate`, dropping/recreating a column that holds data, changing a column's type in a way that can lose data): call them out explicitly and get the human's explicit go-ahead **before** applying — on dev, and again before promoting to production. Report the row count affected when practical (e.g. "N existing rows will be backfilled this way").
12. After creating or rebuilding a dev project, compare it against production (columns, indexes with their names, constraints, triggers, policies, grants, function bodies and ACLs, enums, extensions, realtime tables, storage buckets) before trusting it. The previous baseline had silently drifted from production, which is why the migration history was replaced with production's real one.
