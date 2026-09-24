# Cómo implementar cosas — match-padel-api

## Agregar un endpoint nuevo

Seguí estos pasos en orden. No saltear ninguno.

### 1. Definir el schema de validación

En `src/domains/<dominio>/<dominio>.validators.ts`:

```typescript
export const createReservationSchema = z.object({
  courtId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
})
export type CreateReservationInput = z.infer<typeof createReservationSchema>
```

### 2. Agregar el método al repository

En `src/domains/<dominio>/<dominio>.repository.ts`:

```typescript
async create(input: CreateReservationInput & { userId: string }) {
  const { data, error } = await supabase
    .from('court_reservations')
    .insert(input)
    .select()
    .single()
  if (error) throw new AppError('DB_ERROR', error.message, 500)
  return data
}
```

### 3. Agregar la lógica al service

En `src/domains/<dominio>/<dominio>.service.ts`:

```typescript
async create(input: CreateReservationInput, userId: string) {
  // 1. Verificar disponibilidad (llama al repository)
  const isAvailable = await this.repository.checkAvailability(input.courtId, input.startTime, input.endTime)
  if (!isAvailable) throw new AppError('COURT_NOT_AVAILABLE', 'La cancha no está disponible en ese horario', 409)
  
  // 2. Crear la reserva
  const reservation = await this.repository.create({ ...input, userId })
  
  // 3. Iniciar pago en MercadoPago (si aplica)
  const paymentLink = await createMercadoPagoPreference(reservation)
  
  return { reservation, paymentLink }
}
```

### 4. Agregar el método al controller

En `src/domains/<dominio>/<dominio>.controller.ts`:

```typescript
async create(req: Request, res: Response) {
  // Validar input
  const input = createReservationSchema.safeParse(req.body)
  if (!input.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input inválido', details: input.error.flatten() }
    })
  }
  
  // Llamar al service
  const result = await this.service.create(input.data, req.user.id)
  
  // Devolver response
  return res.status(201).json({ success: true, data: result })
}
```

### 5. Registrar la ruta

En `src/domains/<dominio>/<dominio>.routes.ts`:

```typescript
router.post('/', requireAuth, controller.create.bind(controller))
```

### 6. Escribir el test

En `src/domains/<dominio>/__tests__/<dominio>.test.ts`:

```typescript
describe('POST /api/v1/reservations', () => {
  it('crea una reserva cuando los datos son válidos', async () => {
    vi.mocked(reservationRepository.checkAvailability).mockResolvedValue(true)
    vi.mocked(reservationRepository.create).mockResolvedValue(mockReservation)
    
    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ courtId: '...', startTime: '...', endTime: '...' })
    
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reservation.id).toBeDefined()
  })
})
```

---

## Agregar un dominio nuevo

1. Crear carpeta `src/domains/<nombre>/`
2. Crear los 5 archivos: `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, `validators.ts`
3. Crear `__tests__/<nombre>.test.ts`
4. Registrar el router en `src/app.ts`: `app.use('/api/v1/<nombre>', <nombre>Router)`

---

## Agregar un middleware nuevo

1. Crear `src/middleware/<nombre>.ts`
2. Exportar una función con firma `(req, res, next) => void`
3. Si es global, registrarlo en `src/app.ts` antes de los routers
4. Si es por ruta, encadenarlo en el `routes.ts` del dominio correspondiente

---

## Webhook de MercadoPago

Los webhooks llegan a `POST /api/v1/payments/webhook`. El flujo es:

1. Verificar firma del webhook (header `x-signature`)
2. Buscar el `mp_event_id` en `mp_webhook_events` — si existe, responder 200 y no procesar (idempotencia)
3. Insertar el evento en `mp_webhook_events`
4. Procesar según `type`: `payment` → actualizar estado de la reserva/partido
5. Responder 200 siempre (MercadoPago reintenta si recibe otro status)

---

## Cálculo de ELO (no modificar sin leer ELO-Algorithm.md)

El cálculo se dispara desde `MatchesService.acceptScore()` como una llamada async directa:

```typescript
// En MatchesService
async acceptScore(matchId: string) {
  await this.repository.updateStatus(matchId, 'finished')
  await calculateAndPersistElo(matchId)   // función async, esperar su resolución
  await notifyPlayersEloReady(matchId)    // push notification
}
```

`calculateAndPersistElo` vive en `src/domains/matches/matches.elo-worker.ts` y ejecuta todo en una transacción de Supabase.
