import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './platform.service'
import type { LifecycleAction } from './platform.service'
import type { PlatformRole } from '../../types/access'
import { ForbiddenError } from '../../types/errors'
import {
  applicationParamsSchema,
  approveApplicationSchema,
  clubDocumentParamsSchema,
  clubIdParamsSchema,
  createClubSchema,
  listApplicationsQuerySchema,
  listAuditLogQuerySchema,
  listClubsQuerySchema,
  listUsersQuerySchema,
  rejectApplicationSchema,
  reopenClubSchema,
  requestChangesSchema,
  setClubActiveSchema,
  suspendClubSchema,
  unsuspendClubSchema,
} from './platform.validator'

/** Set by `requireRole`/`loadAccess`; the routes using it always sit behind them. */
function platformRole(req: Request): PlatformRole {
  if (!req.platformRole) throw new ForbiddenError('You do not have permission to perform this action')
  return req.platformRole
}

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
    const { data, meta } = await service.listClubs(query, platformRole(req))
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

export async function getClubDocumentUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = clubDocumentParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getClubDocumentUrl(clubId, id, platformRole(req)) })
  } catch (err) {
    next(err)
  }
}

// ---- Card #68: application review ------------------------------------------

export async function listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listApplicationsQuerySchema.parse(req.query)
    const { data, meta } = await service.listApplications(query, platformRole(req))
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function getApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = applicationParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.getApplication(clubId, platformRole(req)) })
  } catch (err) {
    next(err)
  }
}

function lifecycleHandler(
  action: LifecycleAction,
  readNote: (body: unknown) => string | null,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      const { clubId } = applicationParamsSchema.parse(req.params)
      const note = readNote(req.body ?? {})
      const { userId } = req as AuthenticatedRequest
      const club = await service.applyLifecycleAction(action, clubId, userId, platformRole(req), note)
      res.json({ success: true, data: club })
    } catch (err) {
      next(err)
    }
  }
}

export const approveApplication = lifecycleHandler('approve', (b) => approveApplicationSchema.parse(b).note ?? null)
export const requestChanges = lifecycleHandler('request_changes', (b) => requestChangesSchema.parse(b).note)
export const rejectApplication = lifecycleHandler('reject', (b) => rejectApplicationSchema.parse(b).reason)
export const reopenClub = lifecycleHandler('reopen', (b) => reopenClubSchema.parse(b).note ?? null)
export const suspendClub = lifecycleHandler('suspend', (b) => suspendClubSchema.parse(b).reason)
export const unsuspendClub = lifecycleHandler('unsuspend', (b) => unsuspendClubSchema.parse(b).note ?? null)
