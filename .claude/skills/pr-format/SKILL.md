---
name: pr-format
description: Commit, branch and pull request format used in match-padel-api (English, conventional commits, squash to develop, merge commit to main).
---

# Commit and PR format

**Language: English** for commits, titles and descriptions.

## Branches
`feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>` in kebab-case, always from `develop`. Releases use `release/vX.Y.Z`, cut from `develop`. Never commit or push to `main` or `develop` directly.

## Commits (conventional)
`<type>(<scope>): <imperative summary>` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scope = domain (`auth`, `matches`, `payments`, `db`...). Example: `feat(reservations): add cancel endpoint`.

## Pull requests
- Base **always `develop`**. Title in the same conventional format.
- Body: the full `.github/pull_request_template.md` (What changes / Why / Technical changes / API contract / How to test / Checklist / Related PR). Nothing left empty: "None" or "N/A".
- If there is a counterpart PR in `match-padel-web`, link it; the API PR is merged first.
- Add a **Related Trello card** line with the card's URL (see the `trello-story` skill). Every PR that came from `/implement` has one.

## Merge method (done by the human, never by an agent)
| PR | Base | Method |
|---|---|---|
| Feature / fix / chore branch | `develop` | **Squash** |
| `release/vX.Y.Z` (all pending commits + one `chore: version bump` commit) | `main` | **Merge commit** |
| `main` synced back (`chore: sync develop with main (vX.Y.Z)`) | `develop` | **Merge commit** |

Never use rebase merge. Never delete `main` or `develop` (the sync PR's head branch is `main`). Release title format: `release: vX.Y.Z`. The bump commit subject is exactly `chore: version bump`, with `Bump version from A to B.` in the body. See the `release` skill.
