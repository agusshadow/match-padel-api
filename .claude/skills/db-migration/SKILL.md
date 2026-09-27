---
name: db-migration
description: Steps to change the database schema safely in match-padel-api - apply to dev only, update docs/schema.sql, verify RLS and advisors, document the production SQL.
---

# Database migration

Executed only by the `db-agent` agent.

1. **Project:** dev (`gyjsdgjaufvoqpfceuhu`). Never production (`ebdnlrwzhthqflsbdzvu`).
2. Inspect the current state with `list_tables` before changing anything.
3. Write the migration, idempotent where possible, with a descriptive name.
4. New table: **RLS enabled + policies**. Required extensions declared (`btree_gist`, `uuid-ossp`, etc.).
5. Apply to dev with `apply_migration`.
6. Run `get_advisors` (security) and resolve the warnings.
7. Update `docs/schema.sql` so it reproduces the entire schema from scratch.
8. If types consumed by the frontend change, flag it so they get regenerated (`packages/types` in `match-padel-web`).
9. Document in the PR the exact SQL to run in production and in what order relative to the deploy. **Do not run it.**
10. Destructive changes: call them out explicitly before applying them.
