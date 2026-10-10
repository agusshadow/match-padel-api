import { z } from 'zod'

export const clubParamsSchema = z.object({
  clubId: z.string().uuid(),
})

// Query of the browser redirect from Mercado Pago. Everything is optional on
// purpose: a denied authorization comes back with `error` and no `code`.
export const callbackQuerySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,128}$/)
    .optional(),
  error: z.string().max(100).optional(),
})
export type CallbackQuery = z.infer<typeof callbackQuerySchema>
