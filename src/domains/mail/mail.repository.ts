import { supabase } from '../../lib/supabase'

export type EmailStatus = 'sent' | 'failed' | 'skipped'

export interface EmailLogInput {
  toEmail: string
  template: string
  clubId: string | null
  status: EmailStatus
  providerId: string | null
  error: string | null
}

export async function insertEmailLog(input: EmailLogInput): Promise<void> {
  const { error } = await supabase.from('email_log').insert({
    to_email: input.toEmail,
    template: input.template,
    club_id: input.clubId,
    status: input.status,
    provider_id: input.providerId,
    error: input.error,
  })
  if (error) throw error
}

export async function findClubName(clubId: string): Promise<string | null> {
  const { data, error } = await supabase.from('clubs').select('name').eq('id', clubId).maybeSingle()
  if (error) throw error
  return data?.name ?? null
}

export interface ClubOwnerContact {
  userId: string
  email: string
  firstName: string | null
}

/** Owners of the club (`club_staff.role = 'owner'`) with their auth email. Owners without an email are skipped. */
export async function findClubOwners(clubId: string): Promise<ClubOwnerContact[]> {
  const { data, error } = await supabase
    .from('club_staff')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('role', 'owner')
  if (error) throw error
  const userIds = (data ?? []).map((row) => row.user_id as string)
  if (userIds.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, first_name')
    .in('id', userIds)
  if (profilesError) throw profilesError
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.first_name as string | null) ?? null]))

  const contacts: ClubOwnerContact[] = []
  for (const userId of userIds) {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError) throw authError
    const email = authData.user?.email
    if (email) contacts.push({ userId, email, firstName: names.get(userId) ?? null })
  }
  return contacts
}
