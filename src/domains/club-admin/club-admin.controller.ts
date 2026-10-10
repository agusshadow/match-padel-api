import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './club-admin.service'
import { ValidationError } from '../../types/errors'
import {
  clubParamsSchema,
  courtScheduleParamsSchema,
  createExceptionSchema,
  exceptionParamsSchema,
  listExceptionsQuerySchema,
  previewQuerySchema,
  replacePriceRulesSchema,
  replaceScheduleSchema,
  courtParamsSchema,
  createCourtSchema,
  createMyClubSchema,
  documentParamsSchema,
  updateCourtSchema,
  uploadDocumentBodySchema,
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

// ---- Card #67: onboarding ---------------------------------------------------

/** POST /me/clubs. 201 when a draft is created, 200 when an identical draft already existed. */
export async function createMyClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createMyClubSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    const { club, created } = await service.createMyClub(userId, input)
    res.status(created ? 201 : 200).json({ success: true, data: club })
  } catch (err) {
    next(err)
  }
}

export async function getOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getOnboarding(clubId) })
  } catch (err) {
    next(err)
  }
}

export async function submitApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.submitApplication(clubId, userId) })
  } catch (err) {
    next(err)
  }
}

export async function listCourts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.listCourts(clubId) })
  } catch (err) {
    next(err)
  }
}

export async function createCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const input = createCourtSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await service.createCourt(clubId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function updateCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = courtParamsSchema.parse(req.params)
    const patch = updateCourtSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.updateCourt(clubId, id, userId, patch) })
  } catch (err) {
    next(err)
  }
}

export async function deleteCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = courtParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.deleteCourt(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const body = uploadDocumentBodySchema.parse(req.body)
    const file = req.file
    if (!file) throw new ValidationError('No file uploaded (expected multipart field "file")')
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await service.uploadDocument(clubId, userId, file, body) })
  } catch (err) {
    next(err)
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = documentParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.deleteDocument(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function getDocumentUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = documentParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getDocumentUrl(clubId, id) })
  } catch (err) {
    next(err)
  }
}

// ---- Card #70: schedules, exceptions and price rules ------------------------

export async function getCourtSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, courtId } = courtScheduleParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getCourtSchedule(clubId, courtId) })
  } catch (err) {
    next(err)
  }
}

export async function replaceCourtSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, courtId } = courtScheduleParamsSchema.parse(req.params)
    const input = replaceScheduleSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.replaceCourtSchedule(clubId, courtId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function listExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const query = listExceptionsQuerySchema.parse(req.query)
    res.json({ success: true, data: await service.listExceptions(clubId, query) })
  } catch (err) {
    next(err)
  }
}

export async function createExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const input = createExceptionSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await service.createExceptions(clubId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function deleteException(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = exceptionParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.deleteException(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function getPriceRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, courtId } = courtScheduleParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getPriceRules(clubId, courtId) })
  } catch (err) {
    next(err)
  }
}

export async function replacePriceRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, courtId } = courtScheduleParamsSchema.parse(req.params)
    const input = replacePriceRulesSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.replacePriceRules(clubId, courtId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function previewCourtDay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, courtId } = courtScheduleParamsSchema.parse(req.params)
    const { date } = previewQuerySchema.parse(req.query)
    res.json({ success: true, data: await service.previewCourtDay(clubId, courtId, date) })
  } catch (err) {
    next(err)
  }
}
