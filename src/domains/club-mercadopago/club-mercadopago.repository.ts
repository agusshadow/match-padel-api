import { supabase } from '../../lib/supabase'

// Both tables are API-only (RLS on, no policies, no client grants): only the
// service_role client used here can read or write them.

export type MpAccountStatus = 'connected' | 'expiring' | 'expired' | 'revoked' | 'error'

export interface MpAccountRow {
  club_id: string
  mp_user_id: string
  access_token_enc: string
  refresh_token_enc: string
  public_key: string | null
  scope: string | null
  expires_at: string
  live_mode: boolean | null
  status: MpAccountStatus
  last_refresh_at: string | null
  last_error: string | null
  last_notified_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
}

export interface MpStateRow {
  state_hash: string
  club_id: string
  user_id: string
  code_verifier_enc: string | null
  created_at: string
  expires_at: string
  used_at: string | null
}

const ACCOUNT_COLUMNS =
  'club_id, mp_user_id, access_token_enc, refresh_token_enc, public_key, scope, expires_at, live_mode, status, last_refresh_at, last_error, last_notified_at, connected_by, created_at, updated_at'
const STATE_COLUMNS = 'state_hash, club_id, user_id, code_verifier_enc, created_at, expires_at, used_at'

// ---- OAuth state -------------------------------------------------------------

export async function insertState(input: {
  stateHash: string
  clubId: string
  userId: string
  codeVerifierEnc: string | null
  expiresAt: Date
}): Promise<void> {
  const { error } = await supabase.from('mp_oauth_states').insert({
    state_hash: input.stateHash,
    club_id: input.clubId,
    user_id: input.userId,
    code_verifier_enc: input.codeVerifierEnc,
    expires_at: input.expiresAt.toISOString(),
  })
  if (error) throw error
}

/**
 * Single-use compare-and-set: marks the state used only if it exists, is unused
 * and unexpired, in ONE statement, so two concurrent callbacks cannot both win.
 */
export async function consumeState(stateHash: string, now: Date): Promise<MpStateRow | null> {
  const { data, error } = await supabase
    .from('mp_oauth_states')
    .update({ used_at: now.toISOString() })
    .eq('state_hash', stateHash)
    .is('used_at', null)
    .gt('expires_at', now.toISOString())
    .select(STATE_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as MpStateRow | null) ?? null
}

export async function findState(stateHash: string): Promise<MpStateRow | null> {
  const { data, error } = await supabase
    .from('mp_oauth_states')
    .select(STATE_COLUMNS)
    .eq('state_hash', stateHash)
    .maybeSingle()
  if (error) throw error
  return (data as MpStateRow | null) ?? null
}

export async function deleteStatesExpiredBefore(before: Date): Promise<void> {
  const { error } = await supabase.from('mp_oauth_states').delete().lt('expires_at', before.toISOString())
  if (error) throw error
}

// ---- Accounts ----------------------------------------------------------------

export async function findAccount(clubId: string): Promise<MpAccountRow | null> {
  const { data, error } = await supabase
    .from('club_mp_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return (data as MpAccountRow | null) ?? null
}

export interface UpsertAccountInput {
  clubId: string
  mpUserId: string
  accessTokenEnc: string
  refreshTokenEnc: string
  publicKey: string | null
  scope: string | null
  expiresAt: Date
  liveMode: boolean | null
  connectedBy: string
  now: Date
}

/** Link or re-link: replaces tokens and resets status, error and notification state. */
export async function upsertAccount(input: UpsertAccountInput): Promise<void> {
  const { error } = await supabase.from('club_mp_accounts').upsert(
    {
      club_id: input.clubId,
      mp_user_id: input.mpUserId,
      access_token_enc: input.accessTokenEnc,
      refresh_token_enc: input.refreshTokenEnc,
      public_key: input.publicKey,
      scope: input.scope,
      expires_at: input.expiresAt.toISOString(),
      live_mode: input.liveMode,
      status: 'connected',
      last_refresh_at: input.now.toISOString(),
      last_error: null,
      last_notified_at: null,
      connected_by: input.connectedBy,
    },
    { onConflict: 'club_id' },
  )
  if (error) throw error
}

export interface TokenRotationPatch {
  accessTokenEnc: string
  refreshTokenEnc: string
  expiresAt: Date
  mpUserId: string | null
  publicKey: string | null
  scope: string | null
  liveMode: boolean | null
  now: Date
}

/**
 * Persists a refreshed token pair. Both tokens go in the same UPDATE (atomic),
 * and only if the row still holds the refresh token we used: if another
 * instance already rotated it, this returns null and must not overwrite the
 * newer pair with ours.
 */
export async function rotateTokens(
  clubId: string,
  expectedRefreshTokenEnc: string,
  patch: TokenRotationPatch,
): Promise<MpAccountRow | null> {
  const update: Record<string, unknown> = {
    access_token_enc: patch.accessTokenEnc,
    refresh_token_enc: patch.refreshTokenEnc,
    expires_at: patch.expiresAt.toISOString(),
    status: 'connected',
    last_refresh_at: patch.now.toISOString(),
    last_error: null,
    last_notified_at: null,
  }
  if (patch.mpUserId) update.mp_user_id = patch.mpUserId
  if (patch.publicKey) update.public_key = patch.publicKey
  if (patch.scope) update.scope = patch.scope
  if (patch.liveMode !== null) update.live_mode = patch.liveMode

  const { data, error } = await supabase
    .from('club_mp_accounts')
    .update(update)
    .eq('club_id', clubId)
    .eq('refresh_token_enc', expectedRefreshTokenEnc)
    .select(ACCOUNT_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as MpAccountRow | null) ?? null
}

export async function updateAccountHealth(
  clubId: string,
  patch: { status: MpAccountStatus; lastError: string | null; lastNotifiedAt?: Date | null },
): Promise<void> {
  const update: Record<string, unknown> = { status: patch.status, last_error: patch.lastError }
  if (patch.lastNotifiedAt !== undefined) update.last_notified_at = patch.lastNotifiedAt?.toISOString() ?? null
  const { error } = await supabase.from('club_mp_accounts').update(update).eq('club_id', clubId)
  if (error) throw error
}

export async function deleteAccount(clubId: string): Promise<boolean> {
  const { data, error } = await supabase.from('club_mp_accounts').delete().eq('club_id', clubId).select('club_id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** Accounts whose access token ends before `limit` and that are not already known to be revoked or expired. */
export async function listRefreshCandidates(limit: Date): Promise<MpAccountRow[]> {
  const { data, error } = await supabase
    .from('club_mp_accounts')
    .select(ACCOUNT_COLUMNS)
    .lte('expires_at', limit.toISOString())
    .in('status', ['connected', 'expiring', 'error'])
    .order('expires_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as MpAccountRow[]
}

// ---- Lookups used by the callback --------------------------------------------

export async function findClubStatus(clubId: string): Promise<{ status: string; is_active: boolean } | null> {
  const { data, error } = await supabase.from('clubs').select('status, is_active').eq('id', clubId).maybeSingle()
  if (error) throw error
  return (data as { status: string; is_active: boolean } | null) ?? null
}

/** The callback is not authenticated, so it re-checks that the user who started the link can still do it. */
export async function isOwnerOrSuperadmin(userId: string, clubId: string): Promise<boolean> {
  const [owner, platform] = await Promise.all([
    supabase.from('club_staff').select('user_id').eq('club_id', clubId).eq('user_id', userId).eq('role', 'owner').maybeSingle(),
    supabase.from('platform_staff').select('user_id').eq('user_id', userId).eq('role', 'superadmin').maybeSingle(),
  ])
  if (owner.error) throw owner.error
  if (platform.error) throw platform.error
  return Boolean(owner.data) || Boolean(platform.data)
}

// ---- Charging (card #75): non-secret view of the links --------------------------

export interface MpConnectionSummary {
  club_id: string
  mp_user_id: string
  status: MpAccountStatus
  expires_at: string
}

/** Never selects a token: safe for listings and availability. */
export async function findConnectionSummaries(clubIds: string[]): Promise<MpConnectionSummary[]> {
  if (clubIds.length === 0) return []
  const { data, error } = await supabase
    .from('club_mp_accounts')
    .select('club_id, mp_user_id, status, expires_at')
    .in('club_id', clubIds)
  if (error) throw error
  return (data ?? []) as MpConnectionSummary[]
}
