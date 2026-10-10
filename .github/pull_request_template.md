## What changes
<!-- 1-3 lines, in product language -->

## Why
<!-- Requirement or problem this solves -->

## Technical changes
<!-- Grouped by layer: DB / API / UI -->
-

## API contract
<!-- New or modified endpoints (method, path, request, response). "No changes" if not applicable -->

## How to test
<!-- Steps to verify in the dev environment -->
1.

## Checklist
- [ ] CI is green
- [ ] Tests added or updated
- [ ] Migration file added first (`supabase migration new`), applied to dev only, no existing migration edited, `Migrations` workflow green (or "No schema changes")
- [ ] If there is a migration: it is additive and backward compatible, and pending to be promoted to production **before** the release PR is merged
- [ ] No secrets or production data included
- [ ] Environment variable changes documented
- [ ] Docs updated if behavior or structure changed (`docs/endpoints.md`, "Real state vs. target" in `CLAUDE.md`, `.env.example`)

## Related PR
<!-- Link to the matching PR in the other repo (API merges first), or "None" -->

## Related Trello card
<!-- URL of the match-padel Trello card this implements, or "None" -->
