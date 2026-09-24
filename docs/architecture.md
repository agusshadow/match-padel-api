# Arquitectura — match-padel-api

## Patrón general

Monolito Express organizado por dominios de negocio. No microservicios. Un solo proceso, pero cada dominio es autónomo internamente.

## Dominios y orden de dependencia

```
auth ──────────────────────────────────────── base (sin deps)
users ─────────────────────────────────────── depende de auth
clubs ─────────────────────────────────────── depende de auth, users
reservations ──────────────────────────────── depende de clubs, users
matches ───────────────────────────────────── depende de clubs, users, reservations
tournaments ───────────────────────────────── depende de clubs, matches
platform ──────────────────────────────────── depende de todos (solo super_admin)
```

Implementar en ese orden. No implementar un dominio antes de que sus dependencias estén completas.

## Capas dentro de cada dominio

```
Request HTTP
    │
    ▼
[Router]         — define rutas, encadena middlewares de auth, delega al controller
    │
    ▼
[Controller]     — valida input con Zod, llama al service, forma la response con el envelope
    │
    ▼
[Service]        — lógica de negocio pura; no conoce Express; puede llamar a repositories de otros dominios
    │
    ▼
[Repository]     — ÚNICO lugar con queries a Supabase; devuelve tipos tipados de la DB
    │
    ▼
[Supabase DB]
```

## Módulos globales (src/lib/)

| Archivo | Qué exporta |
|---|---|
| `supabase.ts` | cliente con `service_role` key — bypassa RLS |
| `logger.ts` | logger JSON estructurado (pino o similar) |
| `mercadopago.ts` | instancia configurada del SDK de MP |
| `firebase.ts` | Firebase Admin SDK inicializado |

## Módulos globales (src/middleware/)

| Archivo | Qué hace |
|---|---|
| `requireAuth.ts` | verifica JWT Supabase, agrega `req.user` |
| `requireRole.ts` | verifica `users.role` (solo para `super_admin`) |
| `requireClubStaff.ts` | verifica presencia en tabla `club_staff` con rol requerido |
| `rateLimiter.ts` | express-rate-limit configurado por tier |
| `errorHandler.ts` | catch-all de errores, forma el envelope de error |

## Flujo de un request típico

```
POST /api/v1/matches/:id/scores/accept
    │
    ├─ requireAuth           → verifica JWT, agrega req.user
    ├─ requireClubStaff      → no aplica (es el jugador quien acepta)
    │
    ▼
MatchesController.acceptScore(req, res)
    ├─ valida params con Zod
    ├─ llama MatchesService.acceptScore(matchId, userId)
    │
    ▼
MatchesService.acceptScore(matchId, userId)
    ├─ MatchesRepository.findById(matchId)
    ├─ valida estado del match (debe ser 'disputed')
    ├─ MatchesRepository.updateStatus(matchId, 'finished')
    ├─ calculateElo(matchId)          ← función async directa, no EventEmitter
    │   └─ RankingRepository.upsertRankings(...)  ← transacción atómica
    └─ notifyPlayers(matchId)         ← Firebase FCM
    │
    ▼
Controller devuelve { success: true, data: { match, eloDeltas } }
```

## Decisiones técnicas clave

- **Sin EventEmitter**: el cálculo de ELO es una función async llamada directamente. Si tarda, el cliente espera (máximo ~200ms para el cálculo + 4 writes en transacción).
- **service_role en el backend**: el cliente de Supabase en la API usa `service_role` y bypassa RLS completamente. La seguridad es responsabilidad de los middlewares de Express.
- **CRON jobs fuera del proceso**: los scheduled jobs viven en Supabase Edge Functions, no en node-cron dentro de Express. Si el proceso de Express muere, los jobs siguen corriendo.
- **Un solo cliente de Supabase**: instanciado en `src/lib/supabase.ts`, importado por todos los repositories. No crear nuevas instancias.
