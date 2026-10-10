---
name: db-migration
description: Steps to change the database schema in match-padel-api - write the migration file first, apply it to the dev project, align the recorded version, verify, update docs/schema.sql; production is promoted with the release. Destructive changes need explicit go-ahead.
---

# Database migration

Executed only by the `db-agent` agent (promotion to production is described at the end).

## Principles
- **The file is the source of truth.** `supabase/migrations/` is what gets applied to every environment and what CI replays on an empty database. `docs/schema.sql` is a derived, human-readable view; if they disagree, the migrations win.
- **File first, then the database.** Never apply SQL that is not already in a migration file. Never write the file "afterwards" from memory.
- **Dev first.** Apply to dev (`vrnonxpxksaruvsvbplt`, `match-padel-dev`). Production (`ebdnlrwzhthqflsbdzvu`) only receives the same files at release time.
- **Applied means immutable.** Never edit or delete a file that was already applied anywhere. A mistake is fixed with a new migration. CI blocks edits unless the PR carries the `migrations-rewrite` label (reserved for a deliberate history rewrite like the one on 03/10/2026).

## Authoring and applying to dev
1. **Inspect** the current state with `list_tables` and `docs/schema.sql` before changing anything.
2. **Create the file** with the CLI: `supabase migration new <descriptive_snake_case_name>` (run from the repo root; no login needed). It creates `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` with a UTC timestamp.
3. **Write the SQL** in that file:
   - idempotent where possible (`if not exists`, `create or replace`);
   - every new table gets **RLS enabled and its policies**; required extensions declared (`btree_gist`, `uuid-ossp`, ...);
   - **additive and backward compatible**: the code that is in production must keep working with the new schema, because the migration reaches production *before* the code that uses it (see "Promotion to production");
   - **destructive changes** (`drop`, `truncate`, dropping or recreating a column that holds data, a type change that can lose data) need the human's explicit go-ahead **before** applying, even on dev. State exactly what is affected and the row count when practical. Prefer two releases (add the new thing now, remove the old one later).
4. **Apply to dev** with `apply_migration` (`project_id: vrnonxpxksaruvsvbplt`, `name: <name>`, `query:` the file contents verbatim).
5. **Align the recorded version with the file.** `apply_migration` records the moment it ran as the version. Fix it with `execute_sql` on dev:
   `update supabase_migrations.schema_migrations set version = '<file version>' where name = '<name>' and version <> '<file version>';`
6. **Verify.** `list_migrations` on dev shows the file's version, and `select md5(statements[1]) from supabase_migrations.schema_migrations where version = '<file version>'` equals `md5 -q supabase/migrations/<file>`. If they differ, the database does not have what the file says: stop and fix it.
7. **Run `get_advisors`** (security) and resolve the warnings.

## Documentation and handoff
8. Update `docs/schema.sql` to reflect the change (same PR).
9. If the types consumed by the frontend change, flag it so they are regenerated (`packages/types` in `match-padel-web`, see its README for the project they are generated from).
10. Return: the file name, the SQL, the verification result, and a reminder that the migration still has to be promoted to production with the release.

## CI
The `Migrations` workflow (`.github/workflows/migrations.yml`) runs on every PR that touches `supabase/migrations/`: it blocks edits to existing files, checks file names and unique versions, starts a local Supabase with an empty database (which applies every migration) and checks that every file was recorded as applied. A PR whose migrations do not replay cleanly must not be merged.

## Promotion to production
When the release that depends on the change ships:
1. **List the pending migrations**: files in `supabase/migrations/` whose version is not in `list_migrations` of production.
2. **Apply them in order, before merging the release PR** (Render redeploys the API as soon as `main` changes, so the schema must already be there). For each file repeat steps 4 to 7 against `ebdnlrwzhthqflsbdzvu`: `apply_migration` with the file contents, align the version, verify the `md5`, run `get_advisors`.
3. Only additive, backward compatible changes can go this way. A destructive migration needs the human's explicit go-ahead again, and is done in its own release.
4. **Who does it:** the `release-agent`, invoked from the `release` skill, with no confirmation needed for additive migrations. Every production call goes through `.claude/hooks/guard-production-db.py`, which (a) only lets through a migration whose file exists in `supabase/migrations/` with byte-identical content, (b) asks the human before destructive or security-weakening SQL (drops, truncates, deletes or updates without `where`, column type changes, renames, disabling RLS, table-level grants to anon/authenticated, write policies open to everyone), (c) allows only read queries and the version-alignment update through `execute_sql`, and (d) blocks every other write tool. Nobody else (`db-agent`, `backend-dev`, ...) writes to production.

## After creating or rebuilding a project
Compare it against production before trusting it: columns, indexes with their names, constraints, triggers, policies, grants, function bodies and ACLs, enums, extensions, realtime tables, storage buckets, and the list of recorded migrations (versions, names and contents). The previous baseline had silently drifted from production, which is why the history was replaced with production's real one.
