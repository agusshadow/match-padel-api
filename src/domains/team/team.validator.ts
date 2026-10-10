import { z } from 'zod'

/** Roles an owner can hand out. `owner` is never invitable (ownership transfer is out of scope). */
export const INVITABLE_ROLES = ['admin', 'staff'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

// Raw token: 32 random bytes as base64url (43 chars). Accept a safe range, never anything else.
const tokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{20,128}$/, 'token is not valid')

export const teamParamsSchema = z.object({
  clubId: z.string().uuid(),
})

export const invitationParamsSchema = z.object({
  clubId: z.string().uuid(),
  id: z.string().uuid(),
})

export const memberParamsSchema = z.object({
  clubId: z.string().uuid(),
  userId: z.string().uuid(),
})

export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(INVITABLE_ROLES),
  })
  .strict()
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>

export const updateMemberSchema = z
  .object({
    role: z.enum(INVITABLE_ROLES),
  })
  .strict()
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

export const acceptInvitationSchema = z
  .object({
    token: tokenSchema,
  })
  .strict()
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>

export const previewQuerySchema = z.object({
  token: tokenSchema,
})
export type PreviewQuery = z.infer<typeof previewQuerySchema>
