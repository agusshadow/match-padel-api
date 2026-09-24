# API Patterns — match-padel-api

## Base URL
```
/api/v1/
```

## Envelope de respuesta

Todo response de la API tiene esta forma. Sin excepciones.

**Éxito:**
```json
{
  "success": true,
  "data": { }
}
```

**Éxito con paginación:**
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Descripción legible para el usuario",
    "details": { }
  }
}
```

## Códigos de error estándar

| Código | HTTP | Cuándo usarlo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/params no pasan el schema Zod |
| `UNAUTHORIZED` | 401 | JWT ausente o inválido |
| `FORBIDDEN` | 403 | JWT válido pero sin permisos |
| `NOT_FOUND` | 404 | Recurso no existe |
| `CONFLICT` | 409 | Ya existe (email duplicado, cancha ocupada) |
| `INTERNAL_ERROR` | 500 | Error inesperado |

Códigos de dominio específico siguen el patrón `ENTIDAD_MOTIVO`: `MATCH_NOT_FOUND`, `COURT_NOT_AVAILABLE`, `ELO_CALCULATION_FAILED`.

## Autenticación

Todas las rutas protegidas requieren:
```
Authorization: Bearer <supabase_jwt>
```

El middleware `requireAuth` verifica el JWT contra Supabase y agrega `req.user`:
```typescript
req.user = {
  id: string,       // users.id (UUID)
  email: string,
  role: 'user' | 'super_admin'
}
```

## RBAC — cadena de middlewares

```typescript
// Ruta pública
router.get('/clubs', clubsController.list)

// Requiere estar autenticado
router.get('/reservations', requireAuth, reservationsController.list)

// Solo super_admin
router.get('/platform/clubs', requireAuth, requireRole(['super_admin']), platformController.listClubs)

// Solo staff del club con rol específico
router.post(
  '/:clubId/courts',
  requireAuth,
  requireClubStaff('clubId', ['owner', 'manager']),
  courtsController.create
)
```

`requireClubStaff` recibe el nombre del param de URL que contiene el `clubId` y consulta la tabla `club_staff`.

## Paginación

Query params estándar: `?page=1&limit=20`

El repository recibe `{ page, limit }` y devuelve `{ data, total }`. El service calcula `totalPages` y el controller arma el `meta`.

## Realtime (Supabase)

Solo la tabla `court_reservations` tiene Realtime activado. Publica únicamente: `id`, `court_id`, `start_time`, `end_time`, `status`. Nada más.

El frontend se suscribe directamente a Supabase para disponibilidad de canchas. Todo lo demás usa Socket.io contra la API.

## Socket.io

Eventos que emite la API:
| Evento | Room | Cuándo |
|---|---|---|
| `match:player_joined` | `match:{id}` | Jugador se une al partido |
| `match:score_loaded` | `match:{id}` | Se carga resultado |
| `match:elo_ready` | `match:{id}` | ELO calculado y persistido |
| `staff:new_payment` | `club:{id}` | Pago recibido en el club |
| `chat:message` | `match:{id}` | Mensaje en el chat del partido |

Auth del socket: el cliente envía el JWT en el handshake. El servidor lo verifica antes de permitir join a cualquier room.

## Webhooks MercadoPago

- Endpoint: `POST /api/v1/payments/webhook`
- Sin autenticación JWT (MP no la soporta), pero con verificación de firma `x-signature`
- Idempotentes: verificar `mp_webhook_events.mp_event_id` antes de procesar
- Responder siempre 200 (incluso en error interno) para evitar reintentos infinitos de MP
