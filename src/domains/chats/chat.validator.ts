import { z } from 'zod'

export const SendMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(1000, 'Message is too long'),
})

export type SendMessageRequest = z.infer<typeof SendMessageSchema>
