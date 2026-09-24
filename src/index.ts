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

const app = express()
const PORT = process.env.PORT ?? 3001

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  }),
)

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
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

app.use('/api/v1', v1)

// 404 & error handlers
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[Server] Match Padel API running on http://localhost:${PORT}`)
  console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`)
})

export default app
