# How to implement things — match-padel-api

## Adding a new endpoint

Follow these steps in order. Do not skip any.

### 1. Define the validation schema

In `src/domains/<domain>/<domain>.validators.ts`:

```typescript
export const createReservationSchema = z.object({
  courtId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
})
export type CreateReservationInput = z.infer<typeof createReservationSchema>
```

### 2. Add the method to the repository

In `src/domains/<domain>/<domain>.repository.ts`:

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

### 3. Add the logic to the service

In `src/domains/<domain>/<domain>.service.ts`:

```typescript
async create(input: CreateReservationInput, userId: string) {
  // 1. Check availability (calls the repository)
  const isAvailable = await this.repository.checkAvailability(input.courtId, input.startTime, input.endTime)
  if (!isAvailable) throw new AppError('COURT_NOT_AVAILABLE', 'The court is not available at that time', 409)
  
  // 2. Create the reservation
  const reservation = await this.repository.create({ ...input, userId })
  
  // 3. Start payment in MercadoPago (if applicable)
  const paymentLink = await createMercadoPagoPreference(reservation)
  
  return { reservation, paymentLink }
}
```

### 4. Add the method to the controller

In `src/domains/<domain>/<domain>.controller.ts`:

```typescript
async create(req: Request, res: Response) {
  // Validate input
  const input = createReservationSchema.safeParse(req.body)
  if (!input.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: input.error.flatten() }
    })
  }
  
  // Call the service
  const result = await this.service.create(input.data, req.user.id)
  
  // Return response
  return res.status(201).json({ success: true, data: result })
}
```

### 5. Register the route

In `src/domains/<domain>/<domain>.routes.ts`:

```typescript
router.post('/', requireAuth, controller.create.bind(controller))
```

### 6. Write the test

In `src/domains/<domain>/__tests__/<domain>.test.ts`:

```typescript
describe('POST /api/v1/reservations', () => {
  it('creates a reservation when the data is valid', async () => {
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

## Adding a new domain

1. Create folder `src/domains/<name>/`
2. Create the 5 files: `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, `validators.ts`
3. Create `__tests__/<name>.test.ts`
4. Register the router in `src/app.ts`: `app.use('/api/v1/<name>', <name>Router)`

---

## Adding a new middleware

1. Create `src/middleware/<name>.ts`
2. Export a function with signature `(req, res, next) => void`
3. If it is global, register it in `src/app.ts` before the routers
4. If it is per-route, chain it in the corresponding domain's `routes.ts`

---

## MercadoPago webhook

Webhooks arrive at `POST /api/v1/payments/webhook`. The flow is:

1. Verify the webhook signature (header `x-signature`)
2. Look up the `mp_event_id` in `mp_webhook_events` — if it exists, respond 200 and do not process (idempotency)
3. Insert the event into `mp_webhook_events`
4. Process according to `type`: `payment` → update the reservation/match status
5. Always respond 200 (MercadoPago retries if it receives any other status)

---

## ELO calculation (do not modify without reading ELO-Algorithm.md)

The calculation is triggered from `MatchesService.acceptScore()` as a direct async call:

```typescript
// In MatchesService
async acceptScore(matchId: string) {
  await this.repository.updateStatus(matchId, 'finished')
  await calculateAndPersistElo(matchId)   // async function, await its resolution
  await notifyPlayersEloReady(matchId)    // push notification
}
```

`calculateAndPersistElo` lives in `src/domains/matches/matches.elo-worker.ts` and runs everything in a Supabase transaction.
