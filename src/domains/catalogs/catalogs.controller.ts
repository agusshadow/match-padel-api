import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import { ValidationError } from '../../types/errors'
import * as service from './catalogs.service'
import {
  createAchievementSchema,
  createChallengeSchema,
  createCosmeticSchema,
  idParamsSchema,
  listAchievementsQuerySchema,
  listChallengesQuerySchema,
  listCosmeticsQuerySchema,
  updateAchievementSchema,
  updateChallengeSchema,
  updateCosmeticSchema,
} from './catalogs.validator'

type Handler = (req: Request, res: Response) => Promise<void>

/** Wraps a handler so every error reaches the error middleware. */
function handle(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res)
    } catch (err) {
      next(err)
    }
  }
}

const actor = (req: Request) => (req as AuthenticatedRequest).userId

// ---- Achievements ----------------------------------------------------------

export const listAchievements = handle(async (req, res) => {
  const { data, meta } = await service.listAchievements(listAchievementsQuerySchema.parse(req.query))
  res.json({ success: true, data, meta })
})
export const getAchievement = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  res.json({ success: true, data: await service.getAchievement(id) })
})
export const createAchievement = handle(async (req, res) => {
  const input = createAchievementSchema.parse(req.body)
  res.status(201).json({ success: true, data: await service.createAchievement(actor(req), input) })
})
export const updateAchievement = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  const input = updateAchievementSchema.parse(req.body)
  res.json({ success: true, data: await service.updateAchievement(actor(req), id, input) })
})
export const setAchievementActive = (isActive: boolean) =>
  handle(async (req, res) => {
    const { id } = idParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.setAchievementActive(actor(req), id, isActive) })
  })

// ---- Challenges ------------------------------------------------------------

export const listChallenges = handle(async (req, res) => {
  const { data, meta } = await service.listChallenges(listChallengesQuerySchema.parse(req.query))
  res.json({ success: true, data, meta })
})
export const getChallenge = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  res.json({ success: true, data: await service.getChallenge(id) })
})
export const createChallenge = handle(async (req, res) => {
  const input = createChallengeSchema.parse(req.body)
  res.status(201).json({ success: true, data: await service.createChallenge(actor(req), input) })
})
export const updateChallenge = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  const input = updateChallengeSchema.parse(req.body)
  res.json({ success: true, data: await service.updateChallenge(actor(req), id, input) })
})
export const setChallengeActive = (isActive: boolean) =>
  handle(async (req, res) => {
    const { id } = idParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.setChallengeActive(actor(req), id, isActive) })
  })

// ---- Cosmetics -------------------------------------------------------------

export const listCosmetics = handle(async (req, res) => {
  const { data, meta } = await service.listCosmetics(listCosmeticsQuerySchema.parse(req.query))
  res.json({ success: true, data, meta })
})
export const getCosmetic = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  res.json({ success: true, data: await service.getCosmetic(id) })
})
export const createCosmetic = handle(async (req, res) => {
  const input = createCosmeticSchema.parse(req.body)
  res.status(201).json({ success: true, data: await service.createCosmetic(actor(req), input) })
})
export const updateCosmetic = handle(async (req, res) => {
  const { id } = idParamsSchema.parse(req.params)
  const input = updateCosmeticSchema.parse(req.body)
  res.json({ success: true, data: await service.updateCosmetic(actor(req), id, input) })
})
export const setCosmeticActive = (isActive: boolean) =>
  handle(async (req, res) => {
    const { id } = idParamsSchema.parse(req.params)
    res.json({ success: true, data: await service.setCosmeticActive(actor(req), id, isActive) })
  })

// ---- Images ----------------------------------------------------------------

export const uploadAsset = handle(async (req, res) => {
  const file = req.file
  if (!file) throw new ValidationError('No file uploaded (expected multipart field "file")')
  res.status(201).json({ success: true, data: await service.uploadAsset(actor(req), file) })
})
