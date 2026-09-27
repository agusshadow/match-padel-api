import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  first_name: z.string().min(2, 'Nombre muy corto'),
  last_name: z.string().min(2, 'Apellido muy corto'),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y _'),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced']),
  preferred_hand: z.enum(['drive', 'backhand']),
  phone: z.string().min(6).max(20).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterDto = z.infer<typeof registerSchema>
export type LoginDto = z.infer<typeof loginSchema>
