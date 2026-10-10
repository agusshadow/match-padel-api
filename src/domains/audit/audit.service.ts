import { logger } from '../../lib/logger'
import * as auditRepository from './audit.repository'

export interface RecordAuditInput {
  actorId: string | null
  clubId?: string | null
  action: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Records who did what. It never throws: an audit failure is logged and must
 * not undo or fail the operation that was already performed.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await auditRepository.insertEntry({
      actorId: input.actorId,
      clubId: input.clubId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    })
  } catch (err) {
    logger.error(
      { err, action: input.action, entity: input.entity, entityId: input.entityId ?? null },
      '[audit] failed to record audit entry',
    )
  }
}

export const listAuditLog = auditRepository.list
