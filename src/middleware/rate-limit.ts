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
