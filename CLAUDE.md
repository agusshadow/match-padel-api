# CLAUDE.md — match-padel-api

Este archivo es tu contrato de trabajo. Léelo completo antes de tocar cualquier archivo.

## Qué es este proyecto
API REST para Match Padel. Node.js + Express 4 + TypeScript. Sirve tanto a la PWA de jugadores como al panel de administración B2B.

## Stack
- **Runtime**: Node.js 22 + TypeScript
- **Framework**: Express 4
- **Base de datos**: Supabase (PostgreSQL) — cliente `@supabase/supabase-js` con `service_role` key (bypassa RLS)
- **Auth**: Supabase JWT — verificado en middleware `requireAuth`
- **Pagos**: MercadoPago SDK
- **Push**: Firebase Admin SDK (objetivo; todavía no instalado)
- **Validación**: Zod (en cada controller, siempre)
- **Tests**: Vitest + Supertest (objetivo; todavía no configurado, ver "Estado real vs. objetivo")
- **Logs**: stdout JSON estructurado (no `console.log`, siempre el logger)

## Estructura de carpetas

```
src/
├── domains/          ← un directorio por dominio de negocio
│   ├── auth/
│   ├── clubs/
│   ├── reservations/
│   ├── matches/
│   ├── tournaments/
│   ├── users/
│   └── platform/
├── middleware/       ← middlewares globales reutilizables
├── lib/              ← clientes externos (supabase, mercadopago, firebase, logger)
├── types/            ← tipos globales compartidos (no tipos de dominio)
└── index.ts          ← setup de Express, middlewares globales, registro de routers (punto de entrada)
```

Cada dominio tiene exactamente esta estructura interna:
```
domains/<nombre>/
├── <nombre>.router.ts      ← define rutas y encadena middlewares
├── <nombre>.controller.ts  ← recibe req, valida con Zod, llama service, devuelve res
├── <nombre>.service.ts     ← lógica de negocio pura (sin Express)
├── <nombre>.repository.ts  ← todas las queries a Supabase (único lugar con DB calls)
├── <nombre>.validator.ts   ← schemas Zod exportados y reutilizados en controller
└── __tests__/              ← tests de integración con Supertest
```

## Reglas de arquitectura — NUNCA las rompas

1. **El flujo es siempre**: Router → Controller → Service → Repository. Sin atajos.
2. **El Controller no tiene lógica de negocio**. Solo: parsear req, validar con Zod, llamar service, devolver res.
3. **El Service no sabe que existe Express**. No importa `Request`, `Response` ni `NextFunction`.
4. **El Repository es el único lugar con queries a Supabase**. Ningún otro archivo usa `supabase.from(...)`.
5. **Si una operación toca dos dominios**, el service de uno importa el *repository* del otro. Nunca importa el *service* de otro dominio.
6. **Validación con Zod siempre en el controller**, antes de llamar al service. Si el body no pasa el schema, responder 400 antes de llegar al service.
7. **Nunca declarar tipos a mano** para entidades de la DB. Usar los tipos generados en `src/types/supabase.ts`.

## Envelope de respuesta — formato obligatorio

**Éxito:**
```json
{ "success": true, "data": <payload> }
```

**Error:**
```json
{ "success": false, "error": { "code": "SNAKE_CASE_CODE", "message": "legible", "details": {} } }
```

Códigos de error estándar: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`.

**Paginación** (cuando aplica):
```json
{
  "success": true,
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

## Middlewares de auth (objetivo; hoy solo existe `requireAuth`)

```typescript
requireAuth                          // verifica JWT de Supabase, agrega req.user
requireRole(['super_admin'])         // solo para rutas /platform/*
requireClubStaff(clubId, ['owner', 'manager'])  // verifica club_staff table
```

Siempre en ese orden en la cadena de middlewares de la ruta.

## Variables de entorno

Ver `.env.example`. Nunca hardcodear valores. Acceder siempre via `process.env.NOMBRE`.
Obligatorias hoy: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`. Además `CORS_ORIGIN`, `APP_URL`, `API_URL` y `MP_ACCESS_TOKEN` según el ambiente. (`JWT_SECRET` figuraba antes pero el código no la usa.)

## Rate limiting

- 100 req/min por IP (global)
- 1000 req/min por usuario autenticado
- 5 req/min en endpoints sensibles: `/auth/register`, `/auth/login`, webhooks de MercadoPago

## Cómo agregar un endpoint nuevo

Lee `docs/implementing.md`. Siempre.

## Tests

- Archivo de test en `src/domains/<nombre>/__tests__/<nombre>.test.ts`
- Usar Supertest para tests de integración (no unit tests del controller aislado)
- Mockear Supabase con `vi.mock` en el repository
- Cobertura mínima 70% en `src/domains/`
- Correr con: `npm test` (cuando el framework esté configurado)

## Lo que NO debes hacer

- ❌ `console.log` — usar el logger de `src/lib/logger.ts`
- ❌ Queries a Supabase fuera de un repository
- ❌ Lógica de negocio en el controller
- ❌ Importar tipos de la DB escritos a mano — solo desde `src/types/supabase.ts`
- ❌ Usar `any` en TypeScript
- ❌ Endpoints sin validación Zod
- ❌ Responses sin el envelope `{ success, data/error }`
- ❌ EventEmitter para operaciones async simples — usar `async/await` directo

## Estado real vs. objetivo

Este documento describe la **arquitectura objetivo**. El código existente no siempre la cumple. Para código nuevo seguí el objetivo; no copies los desvíos de la columna derecha, y no los "arregles de paso" sin que el plan lo pida (se limpian en tareas aparte).

| Tema | Objetivo (este documento) | Realidad hoy |
|---|---|---|
| Controllers | Sin lógica ni queries | `auth.controller.ts` hace consultas a Supabase y lógica de negocio |
| Nombres de archivo | `.router.ts`, `.validator.ts` | Correcto en su mayoría; hay routers duplicados en plural (`clubs.router.ts`, `matches.router.ts`, `reservations.router.ts`, `tournaments.router.ts`, `users.router.ts`) sin uso |
| Middleware | Un archivo por responsabilidad | Duplicados: `auth.ts` y `auth.middleware.ts`, `error.ts` y `error.middleware.ts` (10 archivos importan cada versión de auth). **Canónicos: `auth.middleware.ts` y `error.middleware.ts`** (el rate limit real está inline en `index.ts`; `rate-limiter.middleware.ts` solo lo usa el `app.ts` muerto) |
| Punto de entrada | `index.ts` | Además existe `app.ts` duplicado que no se usa |
| Rate limiting | 100/min por IP, 1000/min por usuario, 5/min en endpoints sensibles | 200 requests por 15 min, global, y sin `trust proxy` (detrás de Render todos comparten la misma IP) |
| Auth por rol | `requireRole`, `requireClubStaff` | No existen; solo `requireAuth` |
| Tipos de la DB | Generados en `src/types/supabase.ts` | El archivo no existe |
| Tests | Vitest + Supertest, 70% en `src/domains/` | Sin framework ni tests |
| Logs | Logger, sin `console.log` | Hay usos sueltos de `console.log` |
| Push | Firebase Admin | No instalado |
| Manejo de errores async | Todo error llega al error handler | Hay rechazos de promesas sin manejar que tumban el proceso |

## Flujo de trabajo con agentes

Los requerimientos entran por una sesión de Claude. La sesión principal **orquesta**; los subagentes de `.claude/agents/` ejecutan. El comando `/implement <requerimiento>` (`.claude/skills/implement/`) dispara el flujo completo:

1. `planner` → plan + contrato de API
2. **Checkpoint: el usuario aprueba el plan** (nada se codea antes)
3. `db-agent` (solo si hay cambios de schema; solo Supabase dev)
4. `backend-dev` → implementación
5. `tester` → tests
6. `reviewer` → revisión (máx. 2 vueltas de correcciones)
7. `pr-agent` → rama, commits y PR contra `develop`

| Agente | Responsabilidad |
|---|---|
| `planner` | Plan y contrato de API. Solo lectura |
| `backend-dev` | Código de `src/` (dominios, middleware, pagos, sockets, jobs) |
| `db-agent` | Migraciones, RLS, `docs/schema.sql`. Solo Supabase dev |
| `tester` | Tests. No modifica código de producción |
| `reviewer` | Revisión del diff. No modifica código |
| `pr-agent` | Git y `gh`: ramas, commits, PR |

Skills de apoyo: `new-domain`, `db-migration`, `pr-format`.

## Ramas, ambientes y reglas duras

- `main` es **producción** (Render `match-padel-api`, Supabase `match-padel`). `develop` es la rama de trabajo (Render `match-padel-api-dev`, Supabase `match-padel-dev`).
- Todo PR va contra `develop` y se mergea con **squash**. `develop` → `main` usa **merge commit** y lo hace el humano.
- Commits y PRs en **inglés**, commits convencionales. Ver el skill `pr-format`.
- **Nunca** tocar producción (base de datos, servicios, variables) desde una sesión de agentes. Los cambios de schema se aplican en dev y el SQL para producción queda documentado en el PR.
- Si un cambio de API afecta a `match-padel-web`, el PR de la API se mergea primero y el PR de web lo referencia en "Related PR".
