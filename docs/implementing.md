# How to implement things — match-padel-api

## Adding a new endpoint

Follow these steps in order. Do not skip any.

### 1. Define the validation schema

In `src/domains/<domain>/<domain>.validator.ts` (`<domain>` is the singular entity name, e.g. `reservation`):

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
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  return data
}
```

### 3. Add the logic to the service

In `src/domains/<domain>/<domain>.service.ts`:

```typescript
async create(input: CreateReservationInput, userId: string) {
  // 1. Check availability (calls the repository)
  const isAvailable = await this.repository.checkAvailability(input.courtId, input.startTime, input.endTime)
  if (!isAvailable) throw new AppError('The court is not available at that time', 409, 'COURT_NOT_AVAILABLE')
  
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
  
  // Call the service (target: req.user.id; today requireAuth only sets req.userId, see the note below)
  const result = await this.service.create(input.data, req.user.id)
  
  // Return response
  return res.status(201).json({ success: true, data: result })
}
```

Note: `requireAuth` (`src/middleware/auth.middleware.ts`) sets `req.userId`, not `req.user` (the `req.user` type in `src/types/express.d.ts` is never populated). Today controllers read it with `(req as AuthRequest).userId`. Existing controllers are exported functions with `try/catch` and `next(err)`, not classes; the class style above is illustrative.

### 5. Register the route

In `src/domains/<domain>/<domain>.router.ts`:

```typescript
router.post('/', requireAuth, controller.create.bind(controller))
```

Import `requireAuth` from `../../middleware/auth.middleware` (canonical). Routers export the router with `export default router`.

### 6. Write the test (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)

Vitest and Supertest are not installed and there is no `npm test` script yet. The steps below are the target. In `src/domains/<domain>/__tests__/<domain>.test.ts`:

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
2. Create the 5 files: `<entity>.router.ts`, `<entity>.controller.ts`, `<entity>.service.ts`, `<entity>.repository.ts`, `<entity>.validator.ts` (singular entity name, e.g. `match.router.ts`)
3. Create `__tests__/<entity>.test.ts` (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
4. Register the router in `src/index.ts` (`src/app.ts` is dead code): import it and add `v1.use('/<name>', <entity>Router)` next to the other `v1.use(...)` calls
5. Run `npm run typecheck`

---

## Adding a new middleware

1. Create `src/middleware/<name>.middleware.ts`
2. Export a function with signature `(req, res, next) => void`
3. If it is global, register it in `src/index.ts` before the routers
4. If it is per-route, chain it in the corresponding domain's `<entity>.router.ts`

---

## MercadoPago webhook

Webhooks arrive at `POST /api/v1/payments/webhook`. The flow is:

1. Verify the webhook signature (header `x-signature`) (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
2. Look up the `mp_event_id` in `mp_webhook_events` — if it exists, respond 200 and do not process (idempotency) (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md) (the `mp_webhook_events` table is not in `docs/schema.sql`)
3. Insert the event into `mp_webhook_events` (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md)
4. Process according to `type`: `payment` → update the reservation/match status
5. Always respond 200 (MercadoPago retries if it receives any other status)

Today (`payment.controller.ts` → `handleWebhook` in `payment.service.ts`): the controller responds 200 immediately with no signature check and no idempotency; then, for `type: 'payment'`, the service fetches the payment from the MercadoPago API, updates the `payments` row and moves the `court_reservations` row to `confirmed` (approved) or `cancelled` (rejected/cancelled). Matches are not updated.

---

## ELO calculation (do not modify without reading ELO-Algorithm.md — that file does not exist in the repo today)

Target design (target — not implemented yet; see 'Real state vs. target' in CLAUDE.md). The calculation is triggered from `MatchesService.acceptScore()` as a direct async call:

```typescript
// In MatchesService
async acceptScore(matchId: string) {
  await this.repository.updateStatus(matchId, 'finished')
  await calculateAndPersistElo(matchId)   // async function, await its resolution
  await notifyPlayersEloReady(matchId)    // push notification
}
```

`calculateAndPersistElo` lives in `src/domains/matches/match.elo-worker.ts` and runs everything in a Supabase transaction.

Today: `matchService.acceptScore` in `src/domains/matches/match.service.ts` applies a fixed +15/-15 delta (`ELO_WIN_DELTA` / `ELO_LOSS_DELTA`) to each player of a ranked match through `matchRepository` (updates `users.elo` and inserts into `elo_history`), without a transaction and without a worker file.
