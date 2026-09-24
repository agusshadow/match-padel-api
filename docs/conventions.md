# Convenciones — match-padel-api

## Naming

| Cosa | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `match.service.ts` |
| Clases | PascalCase | `MatchService` |
| Funciones / métodos | camelCase | `findActiveMatches()` |
| Variables | camelCase | `activeMatch` |
| Constantes globales | UPPER_SNAKE | `MAX_PLAYERS_PER_MATCH` |
| Tablas DB (referencia) | snake_case | `court_reservations` |
| Rutas HTTP | kebab-case | `/club-staff/:clubId` |
| Códigos de error | UPPER_SNAKE | `MATCH_NOT_FOUND` |

## Estructura de un dominio — archivos obligatorios

Cada dominio DEBE tener exactamente estos 5 archivos (más la carpeta `__tests__/`):

```
domains/matches/
├── matches.routes.ts
├── matches.controller.ts
├── matches.service.ts
├── matches.repository.ts
├── matches.validators.ts
└── __tests__/
    └── matches.test.ts
```

No crear archivos extra salvo que sean workers específicos (`matches.elo-worker.ts`).

## Tipos

- Los tipos de tablas de Supabase vienen de `src/types/supabase.ts` (autogenerado con `supabase gen types typescript`)
- Los tipos de request/response se definen en `matches.validators.ts` como inferencia de Zod: `type CreateMatchInput = z.infer<typeof createMatchSchema>`
- **Nunca** escribir `interface Match { id: string; ... }` a mano si existe el tipo en supabase.ts

## Validators (Zod)

Definir schemas en `<dominio>.validators.ts` y exportarlos. El controller los importa y usa:

```typescript
// matches.validators.ts
export const createMatchSchema = z.object({
  clubId: z.string().uuid(),
  courtId: z.string().uuid(),
  startTime: z.string().datetime(),
  minCategory: z.enum(['1', '2', '3', '4', '5', '6', '7']),
})
export type CreateMatchInput = z.infer<typeof createMatchSchema>

// matches.controller.ts
const input = createMatchSchema.safeParse(req.body)
if (!input.success) {
  return res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Input inválido', details: input.error.flatten() }
  })
}
```

## Errores

Usar siempre el formato de envelope. Crear una clase `AppError` en `src/lib/errors.ts`:

```typescript
throw new AppError('MATCH_NOT_FOUND', 'El partido no existe', 404)
```

El `errorHandler.ts` global lo captura y forma el response.

## Logging

```typescript
import { logger } from '@/lib/logger'

logger.info({ matchId, userId }, 'Score accepted')
logger.error({ err, matchId }, 'ELO calculation failed')
```

Siempre pasar contexto como primer argumento (objeto), mensaje como segundo.

## Imports

Usar path aliases definidos en `tsconfig.json`:
- `@/domains/...`
- `@/middleware/...`
- `@/lib/...`
- `@/types/...`

No usar rutas relativas con `../../..`.

## HTTP Status codes

| Situación | Status |
|---|---|
| Éxito con data | 200 |
| Creación exitosa | 201 |
| Validación fallida | 400 |
| No autenticado | 401 |
| Sin permisos | 403 |
| No encontrado | 404 |
| Conflicto (ya existe) | 409 |
| Error interno | 500 |

## Variables de entorno

Acceder siempre via `process.env.NOMBRE`. Si es obligatoria y no existe, el proceso debe fallar al iniciar (validar en `src/lib/config.ts`).
