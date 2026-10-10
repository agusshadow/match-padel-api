// Authorization vocabulary shared by the middleware and the domains (card #66).
//
// DB mapping: club_staff.role 'owner' = Dueño, 'admin' = Administrador,
// 'staff' = Recepción. Platform roles come from the platform_staff table.

export type PlatformRole = 'superadmin' | 'reviewer'

export type StaffRole = 'owner' | 'admin' | 'staff'

/** Role a user effectively holds inside a club. A platform superadmin acts as 'superadmin' in every club. */
export type ClubRole = StaffRole | 'superadmin'

export interface ClubMembership {
  clubId: string
  role: StaffRole
}

/** Everything the API needs to authorize a request, loaded once per request. */
export interface AccessContext {
  userId: string
  platformRole: PlatformRole | null
  memberships: ClubMembership[]
}

/** Lifecycle of a club (enum `club_status`, card #67). See docs/club-lifecycle.md. */
export type ClubStatus =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'
