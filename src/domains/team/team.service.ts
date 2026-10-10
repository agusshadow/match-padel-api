import { createHash, randomBytes } from 'crypto'
import { AppError, NotFoundError } from '../../types/errors'
import type { StaffRole } from '../../types/access'
import { recordAudit } from '../audit/audit.service'
import { notifyTeamInvitation } from '../mail/mail.service'
import * as repository from './team.repository'
import type { InvitationRow, MemberRow } from './team.repository'
import type { CreateInvitationInput, InvitableRole } from './team.validator'

export const INVITATION_TTL_DAYS = 7
export const MAX_PENDING_INVITATIONS = 50

const UNIQUE_VIOLATION = '23505'

// ---- Pure helpers (no I/O, unit-testable) ----------------------------------

/** 32 random bytes as base64url (43 chars). Shown once, in the email link. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Only this hash is stored. SHA-256 is enough for a 256-bit random token. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 3_600_000)
}

export function isInvitationExpired(invitation: Pick<InvitationRow, 'status' | 'expires_at'>, now: Date = new Date()): boolean {
  return invitation.status === 'expired' || new Date(invitation.expires_at).getTime() <= now.getTime()
}

/** `maria.lopez@gmail.com` -> `m***@gmail.com`. Enough for the invited person to recognize it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  return `${local.slice(0, 1)}***@${domain}`
}

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
}

// ---- Response shapes -------------------------------------------------------

export interface TeamMember {
  user_id: string
  first_name: string | null
  last_name: string | null
  username: string | null
  email: string | null
  role: StaffRole
  created_at: string
}

export interface TeamInvitation {
  id: string
  email: string
  role: InvitableRole
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
  invited_by: string | null
}

function toInvitation(row: InvitationRow): TeamInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    invited_by: row.invited_by,
  }
}

async function withEmails(rows: MemberRow[]): Promise<TeamMember[]> {
  const identities = await Promise.all(rows.map((r) => repository.findAuthIdentity(r.user_id)))
  return rows.map((r, i) => ({
    user_id: r.user_id,
    first_name: r.first_name,
    last_name: r.last_name,
    username: r.username,
    email: identities[i].email,
    role: r.role,
    created_at: r.created_at,
  }))
}

// ---- Team ------------------------------------------------------------------

export async function listTeam(clubId: string): Promise<{ members: TeamMember[]; invitations: TeamInvitation[] }> {
  await repository.expireStale(clubId)
  const [memberRows, invitationRows] = await Promise.all([
    repository.listMembers(clubId),
    repository.listOpenInvitations(clubId),
  ])
  return { members: await withEmails(memberRows), invitations: invitationRows.map(toInvitation) }
}

async function assertNotMember(clubId: string, email: string): Promise<void> {
  const members = await withEmails(await repository.listMembers(clubId))
  if (members.some((m) => m.email === email)) {
    throw new AppError('This person is already a member of the club', 409, 'ALREADY_MEMBER')
  }
}

async function sendInvitationMail(clubId: string, actorId: string, to: string, role: InvitableRole, token: string) {
  const inviterName = await repository.findUserName(actorId).catch(() => null)
  return notifyTeamInvitation({
    clubId,
    to,
    role,
    inviterName,
    token,
    expiresInDays: INVITATION_TTL_DAYS,
  })
}

export async function createInvitation(
  clubId: string,
  actorId: string,
  input: CreateInvitationInput,
): Promise<TeamInvitation & { email_sent: boolean }> {
  await repository.expireStale(clubId)
  await assertNotMember(clubId, input.email)

  if ((await repository.countPending(clubId)) >= MAX_PENDING_INVITATIONS) {
    throw new AppError('Too many pending invitations; revoke some first', 409, 'INVITATION_LIMIT')
  }

  const token = generateInvitationToken()
  let row: InvitationRow
  try {
    row = await repository.insertInvitation({
      clubId,
      email: input.email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      invitedBy: actorId,
      expiresAt: invitationExpiry().toISOString(),
    })
  } catch (err) {
    if (errorCode(err) === UNIQUE_VIOLATION) {
      const existing = await repository.findPendingByEmail(clubId, input.email)
      throw new AppError('There is already a pending invitation for this email', 409, 'INVITATION_ALREADY_PENDING', {
        invitation_id: existing?.id ?? null,
      })
    }
    throw err
  }

  await recordAudit({
    actorId,
    clubId,
    action: 'team.invitation_created',
    entity: 'club_invitation',
    entityId: row.id,
    metadata: { before: null, after: { email: row.email, role: row.role, status: row.status, expires_at: row.expires_at } },
  })

  const emailSent = await sendInvitationMail(clubId, actorId, row.email, row.role, token)
  return { ...toInvitation(row), email_sent: emailSent }
}

export async function resendInvitation(
  clubId: string,
  id: string,
  actorId: string,
): Promise<TeamInvitation & { email_sent: boolean }> {
  const current = await repository.findInvitationInClub(clubId, id)
  if (!current) throw new NotFoundError('Invitation')
  if (current.status === 'accepted') {
    throw new AppError('The invitation was already accepted', 409, 'INVITATION_ALREADY_ACCEPTED')
  }
  if (current.status === 'revoked') {
    throw new AppError('The invitation was revoked; create a new one', 409, 'INVITATION_REVOKED')
  }
  await assertNotMember(clubId, current.email)

  const token = generateInvitationToken()
  let row: InvitationRow | null
  try {
    row = await repository.rotateInvitation(
      id,
      clubId,
      hashInvitationToken(token),
      actorId,
      invitationExpiry().toISOString(),
    )
  } catch (err) {
    if (errorCode(err) === UNIQUE_VIOLATION) {
      throw new AppError('There is already a pending invitation for this email', 409, 'INVITATION_ALREADY_PENDING')
    }
    throw err
  }
  if (!row) throw new AppError('The invitation can no longer be resent', 409, 'CONFLICT')

  await recordAudit({
    actorId,
    clubId,
    action: 'team.invitation_resent',
    entity: 'club_invitation',
    entityId: row.id,
    metadata: {
      before: { status: current.status, expires_at: current.expires_at },
      after: { status: row.status, expires_at: row.expires_at },
      email: row.email,
    },
  })

  const emailSent = await sendInvitationMail(clubId, actorId, row.email, row.role, token)
  return { ...toInvitation(row), email_sent: emailSent }
}

export async function revokeInvitation(clubId: string, id: string, actorId: string): Promise<TeamInvitation> {
  const current = await repository.findInvitationInClub(clubId, id)
  if (!current) throw new NotFoundError('Invitation')
  if (current.status === 'revoked') return toInvitation(current)
  if (current.status === 'accepted') {
    throw new AppError('The invitation was already accepted; remove the member instead', 409, 'INVITATION_ALREADY_ACCEPTED')
  }

  const row = await repository.revokeInvitation(id, clubId)
  if (!row) throw new AppError('The invitation can no longer be revoked', 409, 'CONFLICT')

  await recordAudit({
    actorId,
    clubId,
    action: 'team.invitation_revoked',
    entity: 'club_invitation',
    entityId: row.id,
    metadata: { before: { status: current.status }, after: { status: row.status }, email: row.email, role: row.role },
  })
  return toInvitation(row)
}

// ---- Members ---------------------------------------------------------------

async function guardMemberChange(clubId: string, actorId: string, userId: string): Promise<StaffRole> {
  if (userId === actorId) {
    throw new AppError('You cannot change your own membership', 403, 'CANNOT_MODIFY_SELF')
  }
  const role = await repository.findMemberRole(clubId, userId)
  if (!role) throw new NotFoundError('Member')
  if (role === 'owner') {
    throw new AppError('The owner of the club cannot be changed or removed', 403, 'CANNOT_MODIFY_OWNER')
  }
  return role
}

export async function changeMemberRole(
  clubId: string,
  userId: string,
  actorId: string,
  role: InvitableRole,
): Promise<TeamMember> {
  const before = await guardMemberChange(clubId, actorId, userId)

  if (before !== role) {
    const updated = await repository.updateMemberRole(clubId, userId, role)
    if (!updated) throw new AppError('The member can no longer be changed', 409, 'CONFLICT')
    await recordAudit({
      actorId,
      clubId,
      action: 'team.member_role_changed',
      entity: 'club_staff',
      entityId: userId,
      metadata: { before: { role: before }, after: { role }, user_id: userId },
    })
  }

  const members = await withEmails((await repository.listMembers(clubId)).filter((m) => m.user_id === userId))
  const member = members[0]
  if (!member) throw new NotFoundError('Member')
  return member
}

export async function removeMember(clubId: string, userId: string, actorId: string): Promise<{ user_id: string }> {
  const before = await guardMemberChange(clubId, actorId, userId)
  const removed = await repository.deleteMember(clubId, userId)
  if (!removed) throw new AppError('The member can no longer be removed', 409, 'CONFLICT')
  await recordAudit({
    actorId,
    clubId,
    action: 'team.member_removed',
    entity: 'club_staff',
    entityId: userId,
    metadata: { before: { role: before }, after: null, user_id: userId },
  })
  return { user_id: userId }
}

// ---- Accepting -------------------------------------------------------------

const invalid = () => new AppError('The invitation is not valid', 404, 'INVITATION_INVALID')

/**
 * Unknown, revoked and used-by-someone-else tokens all answer the same
 * 404 INVITATION_INVALID, so nothing about other invitations leaks.
 */
export async function acceptInvitation(userId: string, token: string): Promise<{ clubId: string; role: StaffRole }> {
  const invitation = await repository.findInvitationByTokenHash(hashInvitationToken(token))
  if (!invitation || invitation.status === 'revoked') throw invalid()

  if (invitation.status === 'accepted') {
    // Idempotent for the person who accepted it.
    if (invitation.accepted_by !== userId) throw invalid()
    const role = await repository.findMemberRole(invitation.club_id, userId)
    if (!role) throw invalid()
    return { clubId: invitation.club_id, role }
  }

  const identity = await repository.findAuthIdentity(userId)
  if (!identity.email || identity.email !== invitation.email.toLowerCase()) {
    throw new AppError('This invitation was sent to another email address', 403, 'INVITATION_EMAIL_MISMATCH')
  }
  if (!identity.emailConfirmed) {
    throw new AppError('Confirm your email before accepting the invitation', 403, 'EMAIL_NOT_CONFIRMED')
  }
  if (isInvitationExpired(invitation)) {
    throw new AppError('The invitation has expired; ask the club owner to resend it', 410, 'INVITATION_EXPIRED')
  }

  const accepted = await repository.acceptInvitation(invitation.id, userId)
  if (!accepted) throw invalid()

  await recordAudit({
    actorId: userId,
    clubId: accepted.club_id,
    action: 'team.invitation_accepted',
    entity: 'club_invitation',
    entityId: invitation.id,
    metadata: {
      before: { status: 'pending' },
      after: { status: 'accepted', role: accepted.role },
      invited_role: invitation.role,
      already_member: accepted.already_member,
    },
  })
  return { clubId: accepted.club_id, role: accepted.role }
}

export interface InvitationPreview {
  club_name: string
  role: InvitableRole
  email_hint: string
  expired: boolean
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const invitation = await repository.findInvitationByTokenHash(hashInvitationToken(token))
  if (!invitation || invitation.status === 'revoked' || invitation.status === 'accepted') throw invalid()
  const clubName = await repository.findClubName(invitation.club_id)
  if (!clubName) throw invalid()
  return {
    club_name: clubName,
    role: invitation.role,
    email_hint: maskEmail(invitation.email),
    expired: isInvitationExpired(invitation),
  }
}
