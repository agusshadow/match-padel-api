# CLAUDE.md — match-padel-api

Este archivo es tu contrato de trabajo. Léelo completo antes de tocar cualquier archivo.

## Qué es este proyecto
API REST para Match Padel. Node.js + Express 5 + TypeScript. Sirve tanto a la PWA de jugadores como al panel de administración B2B.

## Stack
- **Runtime**: Node.js 22 + TypeScript
- **Framework**: Express 5
- **Base de datos**: Supabase (PostgreSQL) — cliente `@supabase/supabase-js` con `service_role` key (bypassa RLS)
- **Auth**: Supabase JWT — verificado en middleware `requireAuth`
- **Pagos**: MercadoPago SDK
- **Push**: Firebase Admin SDK
- **Validación**: Zod (en cada controller, siempre)
- **Tests**: Vitest + Supertest (cobertura mínima 70% en `src/domains/`)
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
└── app.ts            ← setup de Express, middlewares globales, registro de routers
```

Cada dominio tiene exactamente esta estructura interna:
```
domains/<nombre>/
├── <nombre>.routes.ts      ← define rutas y encadena middlewares
├── <nombre>.controller.ts  ← recibe req, valida con Zod, llama service, devuelve res
├── <nombre>.service.ts     ← lógica de negocio pura (sin Express)
├── <nombre>.repository.ts  ← todas las queries a Supabase (único lugar con DB calls)
├── <nombre>.validators.ts  ← schemas Zod exportados y reutilizados en controller
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

## Middlewares de auth disponibles

```typescript
requireAuth                          // verifica JWT de Supabase, agrega req.user
requireRole(['super_admin'])         // solo para rutas /platform/*
requireClubStaff(clubId, ['owner', 'manager'])  // verifica club_staff table
```

Siempre en ese orden en la cadena de middlewares de la ruta.

## Variables de entorno

Ver `.env.example`. Nunca hardcodear valores. Acceder siempre via `process.env.NOMBRE`.
Obligatorias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `JWT_SECRET`.

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
- Correr con: `npm test`

## Lo que NO debes hacer

- ❌ `console.log` — usar el logger de `src/lib/logger.ts`
- ❌ Queries a Supabase fuera de un repository
- ❌ Lógica de negocio en el controller
- ❌ Importar tipos de la DB escritos a mano — solo desde `src/types/supabase.ts`
- ❌ Usar `any` en TypeScript
- ❌ Endpoints sin validación Zod
- ❌ Responses sin el envelope `{ success, data/error }`
- ❌ EventEmitter para operaciones async simples — usar `async/await` directo
