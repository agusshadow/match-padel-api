import { Request, Response, NextFunction } from 'express'
import { marketplaceService } from './marketplace.service'
import { createCurrencyPreference } from '../payments/payment.service'
import { AuthenticatedRequest } from '../../middleware/auth'

export async function getCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const catalog = await marketplaceService.getCatalog()
    res.json({ success: true, data: catalog })
  } catch (err) {
    next(err)
  }
}

export async function getMyCosmetics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const cosmetics = await marketplaceService.getMyCosmetics(userId)
    res.json({ success: true, data: cosmetics })
  } catch (err) {
    next(err)
  }
}

export async function getMyEquipped(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const equipped = await marketplaceService.getMyEquipped(userId)
    res.json({ success: true, data: equipped })
  } catch (err) {
    next(err)
  }
}

export async function getMyBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const balance = await marketplaceService.getMyBalance(userId)
    res.json({ success: true, data: { balance } })
  } catch (err) {
    next(err)
  }
}

export async function purchaseCosmetic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const result = await marketplaceService.purchaseCosmetic(userId, id)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function equipCosmetic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    await marketplaceService.equipCosmetic(userId, id)
    res.json({ success: true, data: { equipped: true } })
  } catch (err) {
    next(err)
  }
}

export async function purchaseCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const result = await createCurrencyPreference(userId)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
