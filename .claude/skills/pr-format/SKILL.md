---
name: pr-format
description: Commit, branch and pull request format used in match-padel-api (English, conventional commits, squash to develop, merge commit to main).
---

# Formato de commits y PRs

**Idioma: inglés** para commits, títulos y descripciones.

## Ramas
`feat/<tema>`, `fix/<tema>`, `chore/<tema>`, `docs/<tema>` en kebab-case, siempre desde `develop`.

## Commits (convencionales)
`<type>(<scope>): <imperative summary>` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scope = dominio (`auth`, `matches`, `payments`, `db`...). Ejemplo: `feat(reservations): add cancel endpoint`.

## Pull requests
- Base **siempre `develop`**. Título con el mismo formato convencional.
- Cuerpo: `.github/pull_request_template.md` completo (What changes / Why / Technical changes / API contract / How to test / Checklist / Related PR). Nada vacío: "None" o "N/A".
- Si hay PR contraparte en `match-padel-web`, enlazarlo; el de la API se mergea primero.

## Método de merge
- PR → `develop`: **squash**.
- `develop` → `main` (producción): **merge commit**. Lo hace el humano.
