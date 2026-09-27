---
name: db-migration
description: Steps to change the database schema safely in match-padel-api - there is no separate dev project, every migration applies directly to production; update docs/schema.sql, verify RLS and advisors, call out destructive changes explicitly.
---

# Database migration

Executed only by the `db-agent` agent.

1. **Project:** there is no separate dev Supabase project anymore (decommissioned 24/09/2026). The only project is `ebdnlrwzhthqflsbdzvu` (`match-padel`, production) — every migration applies there directly. This is safe today because production holds no real user data yet, but treat every change with production-grade care regardless (see step 9).
2. Inspect the current state with `list_tables` before changing anything.
3. Write the migration, idempotent where possible, with a descriptive name.
4. New table: **RLS enabled + policies**. Required extensions declared (`btree_gist`, `uuid-ossp`, etc.).
5. Apply with `apply_migration` against `ebdnlrwzhthqflsbdzvu`.
6. Run `get_advisors` (security) and resolve the warnings.
7. Update `docs/schema.sql` so it reproduces the entire schema from scratch.
8. If types consumed by the frontend change, flag it so they get regenerated (`packages/types` in `match-padel-web`).
9. **Destructive changes** (`drop`, `truncate`, dropping/recreating a column that holds data, changing a column's type in a way that can lose data): call them out explicitly and get the human's explicit go-ahead **before** applying — this is a live production database, even though it is currently empty of real users. Report the row count affected when practical (e.g. "N existing rows will be backfilled this way").
10. This decision (no dev environment, migrations go straight to production) can be revisited if a separate dev project is set up again in the future — until then this is the standing policy, not a one-off exception.
