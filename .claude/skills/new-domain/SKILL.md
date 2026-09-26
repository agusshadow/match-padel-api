---
name: new-domain
description: Recipe to create a new business domain in match-padel-api with the correct layered structure (router, controller, service, repository, validator, tests).
---

# Crear un dominio nuevo

Fuente completa: `docs/implementing.md` ("Agregar un dominio nuevo") y `docs/conventions.md`. Este skill es el resumen operativo.

1. Confirmá que el dominio no existe ya en `src/domains/` y que el plan lo justifica.
2. Creá `src/domains/<nombre>/` con exactamente estos archivos:
   - `<nombre>.validator.ts` — schemas Zod exportados.
   - `<nombre>.repository.ts` — todas las queries a Supabase; devuelve datos, no respuestas HTTP.
   - `<nombre>.service.ts` — lógica de negocio pura, sin Express; lanza errores de `src/types/errors.ts`.
   - `<nombre>.controller.ts` — parsea, valida con Zod, llama al service, responde con el envelope `{ success, data }`.
   - `<nombre>.router.ts` — define rutas y encadena `requireAuth` (de `src/middleware/auth.middleware.ts`) y validaciones.
   - `__tests__/<nombre>.test.ts`.
3. Montá el router en `src/index.ts` bajo `/api/v1/<nombre>`.
4. Si necesita tablas nuevas, pedile el cambio a `db-agent`; no toques el schema.
5. Corré `npm run typecheck`.

Reglas: sin queries fuera del repository, sin `console.log`, sin `any`, y las dependencias entre dominios van repository→repository, nunca service→service.
