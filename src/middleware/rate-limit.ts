import rateLimit from 'express-rate-limit'

// Stricter limit on sensitive auth endpoints (login, register) to slow down
// brute-force / account-creation abuse. Requires `app.set('trust proxy', 1)`
// in index.ts so each client IP is limited individually behind Render's proxy.
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

// Card #67: creating a club draft (POST /me/clubs) is cheap to abuse, so it
// has its own per-IP limit on top of the 10-drafts-per-user cap in the service.
export const createClubLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

// Card #72: inviting (and resending) sends an email, so it is limited per IP on
// top of the 50-pending-invitations cap in the service.
export const teamInvitationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

// Card #72: public invitation preview and acceptance. Tokens are 256-bit random,
// so this only slows down abuse.
export const invitationPreviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

export const acceptInvitationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

// Card #74: starting the Mercado Pago link creates a state row, and the public
// OAuth callback exchanges a code with Mercado Pago, so both are limited per IP.
export const mpConnectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})

export const mpCallbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later' },
})
