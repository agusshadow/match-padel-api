import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function rangeFor(page: number, limit: number): { from: number; to: number } {
  const from = (page - 1) * limit
  return { from, to: from + limit - 1 }
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

/** Strips the characters that would break a PostgREST `.or()` / `ilike` filter built from user input. */
export function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, ' ').trim()
}
