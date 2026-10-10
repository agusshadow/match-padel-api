import { Request, Response, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from './auth'
import type { AccessContext, PlatformRole, StaffRole } from '../types/access'
import { ForbiddenError, UnauthorizedError, ValidationError } from '../types/errors'
import {
  isClubRoleAllowed,
  isPlatformRoleAllowed,
  loadAccess as loadAccessContext,
  resolveClubRole,
} from '../domains/access/access.service'

const clubIdSchema = z.string().uuid()

/**
 * Loads the caller's platform role and club memberships once per request and
 * caches them on `req.access`. Requires `requireAuth` to have run before.
 */
export async function ensureAccess(req: Request): Promise<AccessContext> {
  if (req.access) return req.access

  const userId = (req as AuthenticatedRequest).userId
  if (!userId) throw new UnauthorizedError()

  const access = await loadAccessContext(userId)
  req.access = access
  req.platformRole = access.platformRole
  return access
}

/** Middleware form of `ensureAccess`. */
export async function loadAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureAccess(req)
    next()
  } catch (err) {
    next(err)
  }
}

/** Platform routes. A superadmin passes any list; a reviewer only what lists 'reviewer'. */
export function requireRole(roles: PlatformRole[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      const access = await ensureAccess(req)
      if (!isPlatformRoleAllowed(access.platformRole, roles)) {
        throw new ForbiddenError('You do not have permission to perform this action')
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Club panel routes. Reads `req.params.clubId` (the router must be created with
 * `mergeParams: true` when the id is in the mount path). The caller needs one of
 * `roles` in that club; a platform superadmin is always allowed.
 */
export function requireClubRole(roles: StaffRole[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      const parsed = clubIdSchema.safeParse(req.params.clubId)
      if (!parsed.success) throw new ValidationError('clubId must be a valid UUID')

      const access = await ensureAccess(req)
      const role = resolveClubRole(access, parsed.data)
      if (!isClubRoleAllowed(role, roles)) {
        throw new ForbiddenError('You do not have permission to perform this action in this club')
      }
      req.clubRole = role ?? undefined
      next()
    } catch (err) {
      next(err)
    }
  }
}
