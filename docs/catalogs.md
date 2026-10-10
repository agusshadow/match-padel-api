# Gamification catalogs (card #78, Admin F5)

The superadmin edits the three global catalogs from the platform panel through `/api/v1/platform/catalogs`
(`docs/endpoints.md` has the request/response shapes, `docs/permissions.md` the role matrix). Clubs and reviewers
cannot touch them. Migration: `20261010160513_gamification_catalogs`.

## Rules that apply to all three

- **No delete.** An item is retired with `POST /:id/deactivate` and brought back with `/activate`.
- **Deactivating never removes what players own.** `user_achievements`, `user_challenges` and `user_cosmetics` rows are
  never deleted or edited by a catalog change. An inactive item only stops being *offered*.
- **`code` is the identity key and cannot change** (lowercase snake_case, unique, 409 `CODE_ALREADY_EXISTS`). A PATCH that
  carries `code` is 400.
- Numbers are integers, never negative. Prices and rewards are in the internal currency / XP.
- Edits apply from the next read or event: nothing is recomputed for past purchases or completions.
- Images: upload with `POST /catalogs/assets` (png/jpg/webp, 2 MB) and use the returned `url`.

## Achievements (`achievements`)

| Field | Meaning | Player-visible effect |
|---|---|---|
| `code` | Identity key, immutable | none |
| `name`, `description` | Texts (2..80 / 2..300) | Shown in the achievements screen |
| `icon` | An icon key the app knows (`trophy`, `medal`, `flame`; lowercase) or an https image URL | Icon in the achievements screen (the app falls back to a generic icon for an unknown key) |
| `points` | Points of the achievement (0..100000) | Display only today: nothing is paid out |
| `condition` | `{ "type": "matches_played" \| "wins", "count": n }` (1..100000) | Awarded inside `accept_match_score`, to every player of a completed match whose total matches / wins is `>= count`. Idempotent (a player gets it once). Not retroactive: it is evaluated when the player completes a match |
| `is_active` | Awarding on/off | Inactive: not listed in `GET /achievements` and not awarded any more. Players who already earned it keep it (`GET /achievements/me`) |

The three seeded achievements (`first_match`, `first_win`, `five_wins`) carry exactly the conditions the old hard-coded
logic used, so nothing changed for them. Condition types the SQL does not know are rejected (they would never be
awarded).

## Challenges (`challenges`)

| Field | Meaning | Player-visible effect |
|---|---|---|
| `code` | Identity key, immutable | none |
| `name`, `description` | Texts | Challenge card |
| `cadence` | `daily` / `weekly` / `monthly` / `one_time` | When a new assignment is created and when it expires. **Locked** (409 `CATALOG_FIELD_LOCKED`) once any player was assigned the challenge: changing it would mix periods |
| `action_type` | `play_matches` / `win_matches` | What counts as progress. **Locked** like `cadence` |
| `target_count` | Progress needed (1..10000) | Goal. Applies to in-flight assignments too: a player already at or over the new target completes on the next match |
| `reward_xp`, `reward_currency` | Paid when the challenge completes (0..100000 / 0..1000000) | XP/level and currency. The value read is the one at completion time, also for assignments created before the edit |
| `is_active` | Assignment on/off | Inactive: `assign_and_expire_challenges` (job, every 15 min) stops creating new assignments and `GET /challenges` stops listing it. **Assignments already in flight keep progressing and pay out until their period ends** (or forever for `one_time`), and completed/expired history stays |

If a challenge must stop paying immediately (for example a wrong reward), edit the reward to 0 and then deactivate it.

## Cosmetics (`cosmetics`)

| Field | Meaning | Player-visible effect |
|---|---|---|
| `code` | Identity key, immutable | none |
| `name`, `description` | Texts | Store card |
| `type` | `palette_skin` / `avatar` / `emblem` (the three equip slots) | Which slot it equips in. **Locked** once anyone owns it |
| `image_url` | https image (usually from `/catalogs/assets`) | Store card, and wherever the item is rendered, also for owners |
| `price_currency` | Price in the internal currency (0 = free, up to 1000000) | Applies to future purchases only; owners paid the old price |
| `is_active` | Store on/off | Inactive: not in `GET /marketplace/cosmetics`; `POST /marketplace/cosmetics/:id/purchase` answers 409 `COSMETIC_INACTIVE`. **Owners keep it**: it stays in `GET /marketplace/cosmetics/me`, can be equipped and unequipped as usual, and `GET /marketplace/equipped` returns the cosmetic itself (`palette`/`avatar`/`emblem`) so the app can render it even though it is not in the public catalog |

## Known limits

- Achievements support only the two counters `user_stats` has (matches played, wins). Other condition types need new SQL
  (target — not implemented yet).
- Challenge `action_type` is limited to the `challenge_action` enum (`play_matches`, `win_matches`).
- The player app's marketplace screen builds its grid from the public catalog; an owned item that was deactivated is
  returned by the API (`/cosmetics/me`, `/equipped`) but the screen has to render it from those responses (web half).
