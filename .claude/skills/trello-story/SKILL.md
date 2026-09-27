---
name: trello-story
description: Format for Match Padel Trello cards - user stories written in Spanish (for thesis traceability), board/list/label reference, and how to link a card to its PR.
---

# Trello board reference

Board: **match-padel** — https://trello.com/b/0tQ57s8T/match-padel (single board for both repos).

## Lists (the pipeline)
`Backlog` → `In progress` → `In review` → `Ready to release` → `Done`.

- There is no separate "ready" list: starting a card **is** the signal it's ready. `/implement` resolves the card (see its step 0) and moves it straight from `Backlog` to `In progress` when it starts implementing.
- When `pr-agent` opens the PR against `develop`, move the card to `In review` and add a comment with the PR link.
- As soon as that PR is merged into `develop` (squash, by the human), move the card to `Ready to release` yourself — immediately, don't wait to be asked. This means "done and integrated, not yet in production."
- `Ready to release` cards move to `Done` only when the release that includes their PR is merged into `main`. The `release` skill's Phase 2 does this: for every PR bundled in the release, find its **Related Trello card** and move it to `Done`.

## Labels
Trello's connector cannot rename labels, so they are used **by color**, not by name:

| Color | Meaning |
|---|---|
| green | Touches `match-padel-api` only |
| blue | Touches `match-padel-web` only |
| purple | Touches both repos (two PRs) |
| yellow | Bug |
| orange | Mejora (enhancement) |
| red | Bloqueante / crítico de seguridad |

Attach the color(s) that fit when creating or grooming a card.

# Card format — user story in Spanish

**The card's title and body are always written in Spanish**, regardless of the language of this skill file or of agent output elsewhere — the user's thesis advisors read this board directly. Follow the exact template below; it matches the format already used on the project's original board (`https://trello.com/b/Luxxnp1G/...`), for consistency across both boards.

```
Como <rol>, quiero <acción>, para <beneficio>.

**Criterios de aceptación:**
- Dado <contexto inicial>
- Cuando <acción o evento>
- Entonces <resultado esperado>
(repetir Dado/Cuando/Entonces, o una lista simple de "Entonces ..." para reglas puntuales)

**Subtareas:** <lista breve, opcional — solo si ayuda a estimar>

**Referencia:** <archivo:línea o sección del documento de auditoría que originó la tarjeta, si aplica>
```

Rules:
- `<rol>` is a real project role: "jugador", "staff del club", "super admin", "visitante", or — for purely technical work with no direct end-user framing (infra, CI, refactors) — "equipo de desarrollo" or "responsable técnico del proyecto". Never leave it generic ("usuario").
- Acceptance criteria must be concrete and testable, not vague ("funciona bien"). Prefer Gherkin (Dado/Cuando/Entonces); a flat "Entonces ..." list is fine for simple rule-based cards.
- Keep the story small enough for one `/implement` run (one card ≈ one plan ≈ one PR, or one PR pair for cross-repo work). Split large asks into several cards rather than writing one huge story.
- If the card comes from the product audit artifact, cite the specific finding (risk ID, flow name, or file:line) under **Referencia** so the traceability chain (audit → card → PR → commit) stays intact.

# Linking a card to its PR

`pr-agent` includes the card's Trello URL in the PR body under a **Related Trello card** line (in addition to the existing **Related PR** line used for cross-repo links). See the `pr-format` skill.
