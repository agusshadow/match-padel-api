import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './team.service'
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationParamsSchema,
  memberParamsSchema,
  previewQuerySchema,
  teamParamsSchema,
  updateMemberSchema,
} from './team.validator'

export async function listTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = teamParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.listTeam(clubId) })
  } catch (err) {
    next(err)
  }
}

export async function createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = teamParamsSchema.parse(req.params)
    const input = createInvitationSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await service.createInvitation(clubId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function resendInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = invitationParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.resendInvitation(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function revokeInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = invitationParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.revokeInvitation(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function changeMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, userId: memberId } = memberParamsSchema.parse(req.params)
    const { role } = updateMemberSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.changeMemberRole(clubId, memberId, userId, role) })
  } catch (err) {
    next(err)
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, userId: memberId } = memberParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.removeMember(clubId, memberId, userId) })
  } catch (err) {
    next(err)
  }
}

// POST /me/invitations/accept
export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = acceptInvitationSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.acceptInvitation(userId, token) })
  } catch (err) {
    next(err)
  }
}

// GET /invitations/preview (public)
export async function previewInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = previewQuerySchema.parse(req.query)
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data: await service.previewInvitation(token) })
  } catch (err) {
    next(err)
  }
}
