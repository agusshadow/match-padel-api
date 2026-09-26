---
name: pr-format
description: Commit, branch and pull request format used in match-padel-api (English, conventional commits, squash to develop, merge commit to main).
---

# Commit and PR format

**Language: English** for commits, titles and descriptions.

## Branches
`feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>` in kebab-case, always from `develop`.

## Commits (conventional)
`<type>(<scope>): <imperative summary>` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scope = domain (`auth`, `matches`, `payments`, `db`...). Example: `feat(reservations): add cancel endpoint`.

## Pull requests
- Base **always `develop`**. Title in the same conventional format.
- Body: the full `.github/pull_request_template.md` (What changes / Why / Technical changes / API contract / How to test / Checklist / Related PR). Nothing left empty: "None" or "N/A".
- If there is a counterpart PR in `match-padel-web`, link it; the API PR is merged first.

## Merge method
- PR → `develop`: **squash**.
- `develop` → `main` (production): **merge commit**. Done by the human.
