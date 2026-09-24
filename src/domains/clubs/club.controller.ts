import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { findAll, findById, findCourts } from './club.repository'
import { NotFoundError } from '../../types/errors'

const GetClubsQuerySchema = z.object({
  city: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function getClubes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = GetClubsQuerySchema.parse(req.query)
    const { data, total } = await findAll(query)

    res.json({
      success: true,
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getClubById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const club = await findById(id)

    if (!club) throw new NotFoundError('Club')

    res.json({ success: true, data: club })
  } catch (err) {
    next(err)
  }
}

export async function getClubCourts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { clubId } = req.params
    const courts = await findCourts(clubId)

    res.json({ success: true, data: courts })
  } catch (err) {
    next(err)
  }
}
