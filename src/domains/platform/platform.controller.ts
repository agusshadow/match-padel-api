import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './platform.service'
import {
  clubIdParamsSchema,
  createClubSchema,
  listAuditLogQuerySchema,
  listClubsQuerySchema,
  listUsersQuerySchema,
  setClubActiveSchema,
} from './platform.validator'

export async function getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getSummary() })
  } catch (err) {
    next(err)
  }
}

export async function listClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listClubsQuerySchema.parse(req.query)
    const { data, meta } = await service.listClubs(query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function createClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createClubSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await service.createClub(userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function setClubActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = clubIdParamsSchema.parse(req.params)
    const { isActive } = setClubActiveSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.setClubActive(userId, id, isActive) })
  } catch (err) {
    next(err)
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listUsersQuerySchema.parse(req.query)
    const { data, meta } = await service.listUsers(query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listAuditLogQuerySchema.parse(req.query)
    const { data, meta } = await service.getAuditLog(query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}
