import { supabase } from '../../lib/supabase'
import { rangeFor } from '../../lib/pagination'

export interface AuditEntryInput {
  actorId: string | null
  clubId: string | null
  action: string
  entity: string
  entityId: string | null
  metadata: Record<string, unknown>
}

export interface AuditEntry {
  id: string
  actor_id: string | null
  club_id: string | null
  action: string
  entity: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditListFilters {
  clubId?: string
  actorId?: string
  page: number
  limit: number
}

export async function insertEntry(input: AuditEntryInput): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: input.actorId,
    club_id: input.clubId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    metadata: input.metadata,
  })
  if (error) throw error
}

export async function list(filters: AuditListFilters): Promise<{ data: AuditEntry[]; total: number }> {
  const { from, to } = rangeFor(filters.page, filters.limit)
  let query = supabase
    .from('audit_log')
    .select('id, actor_id, club_id, action, entity, entity_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.clubId) query = query.eq('club_id', filters.clubId)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as AuditEntry[], total: count ?? 0 }
}
