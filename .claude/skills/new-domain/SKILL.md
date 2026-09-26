---
name: new-domain
description: Recipe to create a new business domain in match-padel-api with the correct layered structure (router, controller, service, repository, validator, tests).
---

# Create a new domain

Full reference: `docs/implementing.md` ("Adding a new domain") and `docs/conventions.md`. This skill is the operational summary.

1. Confirm the domain does not already exist in `src/domains/` and that the plan justifies it.
2. Create `src/domains/<name>/` with exactly these files:
   - `<name>.validator.ts` — exported Zod schemas.
   - `<name>.repository.ts` — all Supabase queries; returns data, not HTTP responses.
   - `<name>.service.ts` — pure business logic, no Express; throws errors from `src/types/errors.ts`.
   - `<name>.controller.ts` — parses, validates with Zod, calls the service, responds with the `{ success, data }` envelope.
   - `<name>.router.ts` — defines routes and chains `requireAuth` (from `src/middleware/auth.middleware.ts`) and validations.
   - `__tests__/<name>.test.ts`.
3. Mount the router in `src/index.ts` under `/api/v1/<name>`.
4. If it needs new tables, ask `db-agent` for the change; do not touch the schema.
5. Run `npm run typecheck`.

Rules: no queries outside the repository, no `console.log`, no `any`, and dependencies between domains go repository→repository, never service→service.
