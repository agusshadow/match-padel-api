import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../types/errors'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    })
    return
  }

  // Application errors (our custom hierarchy)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code ?? err.name,
      message: err.message,
    })
    return
  }

  // Supabase/Postgres constraint violations
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code: string; message?: string }
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Conflict', message: 'Resource already exists' })
      return
    }
    // Exclusion violation — e.g. court_reservations.no_overlap, when two people
    // book the same court/time slot in a race. Without this it falls through to
    // the generic 500 below instead of a clear "already booked" 409.
    if (pgErr.code === '23P01') {
      res.status(409).json({ error: 'Conflict', message: 'This time slot is no longer available' })
      return
    }
    // Malformed input (e.g. a route param that isn't a valid uuid) — the client's
    // fault, not the server's, so it should be a 400, not a 500.
    if (pgErr.code === '22P02') {
      res.status(400).json({ error: 'ValidationError', message: 'Invalid identifier or value' })
      return
    }
  }

  // Unknown / unhandled errors
  const message = err instanceof Error ? err.message : 'Something went wrong'
  console.error('[ErrorHandler]', err)
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  })
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'NotFound', message: 'Route not found' })
}
