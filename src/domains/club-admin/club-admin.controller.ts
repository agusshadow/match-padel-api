import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './club-admin.service'
import {
  clubParamsSchema,
  listQuerySchema,
  listReservationsQuerySchema,
  reservationParamsSchema,
  updateClubSchema,
  updateReservationStatusSchema,
} from './club-admin.validator'

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getSummary(clubId) })
  } catch (err) {
    next(err)
  }
}

export async function listReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const query = listReservationsQuerySchema.parse(req.query)
    const { data, meta } = await service.listReservations(clubId, query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function updateReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = reservationParamsSchema.parse(req.params)
    const { status } = updateReservationStatusSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.updateReservationStatus(clubId, id, userId, status) })
  } catch (err) {
    next(err)
  }
}

export async function listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const query = listQuerySchema.parse(req.query)
    const { data, meta } = await service.listMatches(clubId, query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function listTournaments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const query = listQuerySchema.parse(req.query)
    const { data, meta } = await service.listTournaments(clubId, query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function getClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getClub(clubId) })
  } catch (err) {
    next(err)
  }
}

export async function updateClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const patch = updateClubSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.updateClub(clubId, userId, patch) })
  } catch (err) {
    next(err)
  }
}
