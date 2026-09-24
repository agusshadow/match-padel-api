import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { errorHandler } from './middleware/error.middleware'
import { rateLimiter } from './middleware/rate-limiter.middleware'

// Routers
import { authRouter } from './domains/auth/auth.router'
import { usersRouter } from './domains/users/users.router'
import { clubsRouter } from './domains/clubs/clubs.router'
import { reservationsRouter } from './domains/reservations/reservations.router'
import { matchesRouter } from './domains/matches/matches.router'
import { tournamentsRouter } from './domains/tournaments/tournaments.router'
import { platformRouter } from './domains/platform/platform.router'

export const app = express()

// Security & parsing
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
}))
app.use(express.json())
app.use(rateLimiter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API v1
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/clubs', clubsRouter)
app.use('/api/v1/clubs', reservationsRouter)   // /clubs/:clubId/reservations
app.use('/api/v1/matches', matchesRouter)
app.use('/api/v1/tournaments', tournamentsRouter)
app.use('/api/v1/platform', platformRouter)

// Error handler (siempre al final)
app.use(errorHandler)
