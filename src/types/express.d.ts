import type { User } from '@supabase/supabase-js'
import type { AccessContext, ClubRole, PlatformRole } from './access'

declare global {
  namespace Express {
    interface Request {
      user?: User & {
        role?: string
      }
      /** Set by loadAccess / requireRole / requireClubRole (card #66). */
      access?: AccessContext
      /** Platform role of the caller, null when they have none. Set together with `access`. */
      platformRole?: PlatformRole | null
      /** Role the caller holds in the club of `req.params.clubId`. Set by requireClubRole. */
      clubRole?: ClubRole
    }
  }
}
