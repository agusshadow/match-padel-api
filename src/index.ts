import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { errorHandler, notFound } from './middleware/error.middleware'
import authRouter from './domains/auth/auth.router'
import matchRouter from './domains/matches/match.router'
import userRouter from './domains/users/user.router'
import reservationRouter from './domains/reservations/reservation.router'
import clubRouter from './domains/clubs/club.router'
import courtRouter from './domains/courts/court.router'
import notificationRouter from './domains/notifications/notification.router'
import tournamentRouter from './domains/tournaments/tournament.router'
import paymentRouter from './domains/payments/payment.router'
import achievementsRouter from './domains/achievements/achievements.router'
import challengesRouter from './domains/challenges/challenges.router'
import marketplaceRouter from './domains/marketplace/marketplace.router'
import { expireReservationsJob } from './jobs/expire-reservations.job'
import { autoCancelUnfilledMatchesJob } from './jobs/auto-cancel-unfilled-matches.job'
import { assignAndExpireChallengesJob } from './jobs/assign-and-expire-challenges.job'

const app = express()
const PORT = process.env.PORT ?? 3001

// Render sits in front of the API as a reverse proxy. Without this, express-rate-limit
// (and req.ip in general) sees Render's proxy IP for every request instead of the
// client's real IP, so all users share a single rate-limit bucket.
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  }),
)

// Rate limiting — global per-IP limit
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

// Body parsing
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
const v1 = express.Router()

v1.use('/auth', authRouter)
v1.use('/matches', matchRouter)
v1.use('/users', userRouter)
v1.use('/reservations', reservationRouter)
v1.use('/clubs', clubRouter)
v1.use('/courts', courtRouter)
v1.use('/notifications', notificationRouter)
v1.use('/tournaments', tournamentRouter)
v1.use('/payments', paymentRouter)
v1.use('/achievements', achievementsRouter)
v1.use('/challenges', challengesRouter)
v1.use('/marketplace', marketplaceRouter)

app.use('/api/v1', v1)

// 404 & error handlers
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[Server] Match Padel API running on http://localhost:${PORT}`)
  console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`)
})

// Scheduled jobs run in this same process (no separate worker/dyno) since the
// API already runs 24/7 on Render — see src/jobs/scheduler.ts.
expireReservationsJob.start()
autoCancelUnfilledMatchesJob.start()
assignAndExpireChallengesJob.start()

// Last-resort safety net: log and keep the process alive instead of letting an
// unhandled rejection or a truly uncaught exception crash the whole API for every
// user. Individual routes should still catch/handle their own errors — this only
// covers what slips through (e.g. a promise nobody awaited).
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err)
})

export default app
