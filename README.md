# match-padel-api

REST API for Match Padel. Node.js + TypeScript + Express 4, with Supabase (PostgreSQL) as the database and MercadoPago for payments. It serves the player PWA and the admin panel in [`match-padel-web`](https://github.com/agusshadow/match-padel-web).

## Environments

| Environment | Branch | Render service | URL | Supabase project |
|---|---|---|---|---|
| Production | `main` | `match-padel-api` | https://match-padel-api.onrender.com | `match-padel` |
| Dev | `develop` | `match-padel-api-dev` | https://match-padel-api-dev.onrender.com | `match-padel-dev` |

Render redeploys each service automatically when its branch changes. Local development must use the **dev** Supabase project, never production.

## Setup

```bash
npm install
cp .env.example .env     # then fill in the values (dev Supabase project)
npm run dev              # http://localhost:3001, health check at /health
```

| Script | What it does |
|---|---|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Type-check without emitting |

There is no test framework yet (see "Real state vs. target" in `CLAUDE.md`).

## Environment variables

See `.env.example`. Required: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. In deployed environments also set `CORS_ORIGIN`, `APP_URL`, `API_URL` and `MP_ACCESS_TOKEN`. Never commit `.env` or share the service role key.

## Working on this repo

- `main` and `develop` accept **no direct commits or pushes**. Work on a branch from `develop` and open a pull request against it (squash merge). Releases go through a `release/vX.Y.Z` branch (merge commit). Details in `CLAUDE.md`.
- Enable the local git hooks once per clone: `git config core.hooksPath .githooks`.
- With Claude Code, use `/implement <requirement>` for a change (plan, your approval, code, tests, review, PR) and `/release` to cut a release. Agents and skills live in `.claude/`.
- Commits and PRs are written in English, using conventional commits.

## Documentation

Everything under `docs/` is written for humans and agents alike, in English.

- [`CLAUDE.md`](./CLAUDE.md) — working contract: stack, architecture rules, real state vs. target, workflow.
- [`docs/endpoints.md`](./docs/endpoints.md) — every endpoint mounted today.
- [`docs/architecture.md`](./docs/architecture.md), [`docs/conventions.md`](./docs/conventions.md), [`docs/implementing.md`](./docs/implementing.md), [`docs/api-patterns.md`](./docs/api-patterns.md) — target architecture and how-tos.
- [`supabase/migrations/`](./supabase/migrations) — the versioned history of the database and the source of truth: the 35 migrations recorded in production (24/09 to 30/09/2026, exact versions, names and SQL) plus every change since. Applying them to an empty project reproduces production; the `Migrations` GitHub workflow checks that on every PR.
- [`docs/schema.sql`](./docs/schema.sql) — a human-readable view of the schema, derived from the migrations (they win if they disagree).

### Changing the database

File first, always: `supabase migration new <name>`, write the SQL, apply it to the **dev** project, align the recorded version with the file and verify it, then update `docs/schema.sql`. Never edit a migration that was already applied; add a new one. Production receives the same files at release time, before the release PR is merged. Full steps: the `db-migration` skill (`.claude/skills/db-migration/SKILL.md`).
