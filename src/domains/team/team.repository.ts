import { supabase } from '../../lib/supabase'
import type { StaffRole } from '../../types/access'

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface InvitationRow {
  id: string
  club_id: string
  email: string
  role: 'admin' | 'staff'
  token_hash: string
  invited_by: string | null
  status: InvitationStatus
  expires_at: string
  accepted_by: string | null
  accepted_at: string | null
  created_at: string
}

const INVITATION_COLUMNS =
  'id, club_id, email, role, token_hash, invited_by, status, expires_at, accepted_by, accepted_at, created_at'

export interface MemberRow {
  user_id: string
  role: StaffRole
  created_at: string
  first_name: string | null
  last_name: string | null
  username: string | null
}

// ---- Members ---------------------------------------------------------------

export async function listMembers(clubId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('club_staff')
    .select('user_id, role, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Array<{ user_id: string; role: StaffRole; created_at: string }>
  if (rows.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, first_name, last_name, username')
    .in('id', rows.map((r) => r.user_id))
  if (profilesError) throw profilesError
  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      p as { first_name: string | null; last_name: string | null; username: string | null },
    ]),
  )
  return rows.map((r) => ({
    user_id: r.user_id,
    role: r.role,
    created_at: r.created_at,
    first_name: byId.get(r.user_id)?.first_name ?? null,
    last_name: byId.get(r.user_id)?.last_name ?? null,
    username: byId.get(r.user_id)?.username ?? null,
  }))
}

export async function findMemberRole(clubId: string, userId: string): Promise<StaffRole | null> {
  const { data, error } = await supabase
    .from('club_staff')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.role as StaffRole | undefined) ?? null
}

/** Compare-and-set: an owner row is never matched, so a race cannot demote the owner. */
export async function updateMemberRole(clubId: string, userId: string, role: InvitationRow['role']): Promise<boolean> {
  const { data, error } = await supabase
    .from('club_staff')
    .update({ role })
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .neq('role', 'owner')
    .select('user_id')
  if (error) throw error
  return (data ?? []).length > 0
}

export async function deleteMember(clubId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('club_staff')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .neq('role', 'owner')
    .select('user_id')
  if (error) throw error
  return (data ?? []).length > 0
}

export interface AuthIdentity {
  email: string | null
  emailConfirmed: boolean
}

/** Email lives in Supabase Auth, not in public.users. */
export async function findAuthIdentity(userId: string): Promise<AuthIdentity> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user) return { email: null, emailConfirmed: false }
  return {
    email: data.user.email ? data.user.email.toLowerCase() : null,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  }
}

export async function findUserName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return name || null
}

export async function findClubName(clubId: string): Promise<string | null> {
  const { data, error } = await supabase.from('clubs').select('name').eq('id', clubId).maybeSingle()
  if (error) throw error
  return (data?.name as string | undefined) ?? null
}

// ---- Invitations -----------------------------------------------------------

/** Lazy expiry: pending invitations past their deadline become `expired` (frees the pending-email slot). */
export async function expireStale(clubId: string): Promise<void> {
  const { error } = await supabase
    .from('club_invitations')
    .update({ status: 'expired' })
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .lte('expires_at', new Date().toISOString())
  if (error) throw error
}

export async function listOpenInvitations(clubId: string): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from('club_invitations')
    .select(INVITATION_COLUMNS)
    .eq('club_id', clubId)
    .in('status', ['pending', 'expired'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as InvitationRow[]
}

export async function countPending(clubId: string): Promise<number> {
  const { count, error } = await supabase
    .from('club_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function findPendingByEmail(clubId: string, email: string): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from('club_invitations')
    .select(INVITATION_COLUMNS)
    .eq('club_id', clubId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export async function findInvitationInClub(clubId: string, id: string): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from('club_invitations')
    .select(INVITATION_COLUMNS)
    .eq('club_id', clubId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from('club_invitations')
    .select(INVITATION_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export interface NewInvitation {
  clubId: string
  email: string
  role: InvitationRow['role']
  tokenHash: string
  invitedBy: string
  expiresAt: string
}

export async function insertInvitation(input: NewInvitation): Promise<InvitationRow> {
  const { data, error } = await supabase
    .from('club_invitations')
    .insert({
      club_id: input.clubId,
      email: input.email,
      role: input.role,
      token_hash: input.tokenHash,
      invited_by: input.invitedBy,
      expires_at: input.expiresAt,
    })
    .select(INVITATION_COLUMNS)
    .single()
  if (error) throw error
  return data as InvitationRow
}

/** Rotates the token and re-opens a pending or expired invitation. Null when it is no longer resendable. */
export async function rotateInvitation(
  id: string,
  clubId: string,
  tokenHash: string,
  invitedBy: string,
  expiresAt: string,
): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from('club_invitations')
    .update({ token_hash: tokenHash, status: 'pending', invited_by: invitedBy, expires_at: expiresAt })
    .eq('id', id)
    .eq('club_id', clubId)
    .in('status', ['pending', 'expired'])
    .select(INVITATION_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export async function revokeInvitation(id: string, clubId: string): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from('club_invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('club_id', clubId)
    .in('status', ['pending', 'expired'])
    .select(INVITATION_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export interface AcceptedInvitation {
  club_id: string
  role: StaffRole
  already_member: boolean
}

/** Atomic accept + membership (RPC `accept_club_invitation`). Null when the invitation is no longer acceptable. */
export async function acceptInvitation(invitationId: string, userId: string): Promise<AcceptedInvitation | null> {
  const { data, error } = await supabase.rpc('accept_club_invitation', {
    p_invitation_id: invitationId,
    p_user_id: userId,
  })
  if (error) throw error
  const rows = (data ?? []) as AcceptedInvitation[]
  return rows[0] ?? null
}
