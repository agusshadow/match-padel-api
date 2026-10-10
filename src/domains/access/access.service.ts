import type { AccessContext, ClubRole, PlatformRole, StaffRole } from '../../types/access'
import * as accessRepository from './access.repository'

// ---- Pure authorization decisions (no I/O, unit-testable) ------------------

/** Superadmin passes any platform check; any other role must be listed. */
export function isPlatformRoleAllowed(
  platformRole: PlatformRole | null,
  allowed: readonly PlatformRole[],
): boolean {
  if (platformRole === null) return false
  if (platformRole === 'superadmin') return true
  return allowed.includes(platformRole)
}

/** Role the caller holds in a club, or null when they have none. A superadmin holds 'superadmin' everywhere. */
export function resolveClubRole(access: AccessContext, clubId: string): ClubRole | null {
  if (access.platformRole === 'superadmin') return 'superadmin'
  const membership = access.memberships.find((m) => m.clubId === clubId)
  return membership?.role ?? null
}

export function isClubRoleAllowed(role: ClubRole | null, allowed: readonly StaffRole[]): boolean {
  if (role === null) return false
  if (role === 'superadmin') return true
  return allowed.includes(role)
}

// ---- Loading ---------------------------------------------------------------

export async function loadAccess(userId: string): Promise<AccessContext> {
  const [platformRole, memberships] = await Promise.all([
    accessRepository.findPlatformRole(userId),
    accessRepository.findMemberships(userId),
  ])
  return { userId, platformRole, memberships }
}

export interface MyAccess {
  user: { id: string; email: string | null; first_name: string | null; last_name: string | null }
  platformRole: PlatformRole | null
  clubs: Array<{ clubId: string; name: string; slug: string; isActive: boolean; role: ClubRole }>
}

export async function getMyAccess(access: AccessContext): Promise<MyAccess> {
  const isSuperadmin = access.platformRole === 'superadmin'

  const [profile, email, clubs] = await Promise.all([
    accessRepository.findProfile(access.userId),
    accessRepository.findEmail(access.userId),
    isSuperadmin
      ? accessRepository.findAllClubs()
      : accessRepository.findClubsByIds(access.memberships.map((m) => m.clubId)),
  ])

  return {
    user: {
      id: access.userId,
      email,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
    },
    platformRole: access.platformRole,
    clubs: clubs.map((club) => ({
      clubId: club.id,
      name: club.name,
      slug: club.slug,
      isActive: club.is_active,
      role: resolveClubRole(access, club.id) as ClubRole,
    })),
  }
}
