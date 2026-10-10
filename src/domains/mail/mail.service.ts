import { logger } from '../../lib/logger'
import { getResend } from '../../lib/resend'
import type { ClubStatus } from '../../types/access'
import * as repository from './mail.repository'
import type { EmailStatus } from './mail.repository'
import { escapeHtml, render } from './mail.templates'
import type { MailTemplate, TemplateData } from './mail.templates'

const DEFAULT_FROM = 'Match Padel <no-reply@matchpadel.com.ar>'
const DEFAULT_CLUB_PANEL_URL = 'https://match-padel-admin.vercel.app'
const SEND_TIMEOUT_MS = 10_000

export type MailMode = 'send' | 'log'

export interface MailConfig {
  mode: MailMode
  hasApiKey: boolean
  from: string
  isProduction: boolean
  devRecipient: string | null
  clubPanelUrl: string
}

/** Read on every call so a changed env var (and tests) take effect without a restart of the module. */
export function getMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const hasApiKey = Boolean(env.RESEND_API_KEY?.trim())
  const requested = env.MAIL_MODE?.trim().toLowerCase()
  const mode: MailMode = requested === 'send' || requested === 'log' ? requested : hasApiKey ? 'send' : 'log'
  const environment = (env.APP_ENV?.trim() || env.NODE_ENV?.trim() || 'development').toLowerCase()
  return {
    mode,
    hasApiKey,
    from: env.MAIL_FROM?.trim() || DEFAULT_FROM,
    isProduction: environment === 'production',
    devRecipient: env.MAIL_DEV_RECIPIENT?.trim() || null,
    clubPanelUrl: env.CLUB_PANEL_URL?.trim() || DEFAULT_CLUB_PANEL_URL,
  }
}

export interface SendMailInput {
  to: string
  template: MailTemplate
  data: TemplateData
  clubId?: string | null
}

export interface SendMailResult {
  status: EmailStatus
  providerId: string | null
  error: string | null
}

async function recordAttempt(
  input: SendMailInput,
  result: SendMailResult,
): Promise<void> {
  try {
    await repository.insertEmailLog({
      toEmail: input.to,
      template: input.template,
      clubId: input.clubId ?? null,
      status: result.status,
      providerId: result.providerId,
      error: result.error,
    })
  } catch (err) {
    logger.error({ err, template: input.template, clubId: input.clubId }, '[mail] failed to record email_log')
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

async function deliver(input: SendMailInput): Promise<SendMailResult> {
  const config = getMailConfig()
  const rendered = render(input.template, { ...input.data, panelUrl: input.data.panelUrl || config.clubPanelUrl })

  let subject = rendered.subject
  let html = rendered.html
  let text = rendered.text
  let recipient = input.to

  if (!config.isProduction) {
    subject = `[DEV] ${subject}`
    if (config.devRecipient) {
      recipient = config.devRecipient
      const note = `Destinatario original: ${input.to}`
      html = html.replace('</body>', `<p style="font-size:12px;color:#6b7280;text-align:center;">${escapeHtml(note)}</p></body>`)
      text = `${text}\n\n${note}`
    }
  }

  if (config.mode === 'log') {
    logger.info(
      { template: input.template, to: recipient, originalTo: input.to, subject, clubId: input.clubId ?? null },
      '[mail] MAIL_MODE=log, email not sent',
    )
    return { status: 'skipped', providerId: null, error: null }
  }

  const resend = getResend()
  if (!resend) {
    logger.warn({ template: input.template }, '[mail] MAIL_MODE=send but RESEND_API_KEY is not set, email skipped')
    return { status: 'skipped', providerId: null, error: 'RESEND_API_KEY is not set' }
  }

  let timer: NodeJS.Timeout | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Resend request timed out after ${SEND_TIMEOUT_MS} ms`)), SEND_TIMEOUT_MS)
    })
    const { data, error } = await Promise.race([
      resend.emails.send({ from: config.from, to: recipient, subject, html, text }),
      timeout,
    ])
    if (error) {
      return { status: 'failed', providerId: null, error: `${error.name}: ${error.message}` }
    }
    return { status: 'sent', providerId: data?.id ?? null, error: null }
  } catch (err) {
    return { status: 'failed', providerId: null, error: describeError(err) }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Renders and sends one email. Never throws: any failure is logged, recorded
 * in `email_log` and returned, so a mail problem can never break the operation
 * that triggered it.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  let result: SendMailResult
  try {
    result = await deliver(input)
  } catch (err) {
    result = { status: 'failed', providerId: null, error: describeError(err) }
  }
  if (result.status === 'failed') {
    logger.error(
      { template: input.template, clubId: input.clubId ?? null, error: result.error },
      '[mail] failed to send email',
    )
  }
  await recordAttempt(input, result)
  return result
}

const STATUS_TEMPLATES: Partial<Record<ClubStatus, MailTemplate>> = {
  pending: 'application_received',
  changes_requested: 'changes_requested',
  approved: 'approved',
  rejected: 'rejected',
  suspended: 'suspended',
}

/**
 * Template for a status change. `suspended` to `approved` is a reinstatement,
 * not a first approval, so it needs the previous status to be told apart.
 */
export function templateForStatusChange(fromStatus: ClubStatus | null | undefined, toStatus: ClubStatus): MailTemplate | null {
  if (fromStatus === 'suspended' && toStatus === 'approved') return 'reinstated'
  return STATUS_TEMPLATES[toStatus] ?? null
}

export interface NotifyApplicationStatusChangeInput {
  clubId: string
  /** Previous status; only needed to tell a reinstatement (`suspended` to `approved`) from a first approval. */
  fromStatus?: ClubStatus | null
  toStatus: ClubStatus
  /** Reviewer notes (`changes_requested`) or reason (`rejected`, `suspended`); optional note for `approved`. */
  note?: string | null
}

/**
 * Tells the owner(s) of a club that its application changed status. Call it
 * AFTER the status change succeeded and do not rely on its result: it never
 * throws and never fails the caller, it only logs. Statuses without a template
 * (`draft`) are ignored.
 *
 * Fire-and-forget usage: `void notifyApplicationStatusChange({ ... })`.
 */
export async function notifyApplicationStatusChange(input: NotifyApplicationStatusChangeInput): Promise<void> {
  try {
    const template = templateForStatusChange(input.fromStatus, input.toStatus)
    if (!template) return

    const [clubName, owners] = await Promise.all([
      repository.findClubName(input.clubId),
      repository.findClubOwners(input.clubId),
    ])
    if (owners.length === 0) {
      logger.warn({ clubId: input.clubId, template }, '[mail] club has no owner with an email, nothing to send')
      return
    }

    const { clubPanelUrl } = getMailConfig()
    await Promise.all(
      owners.map((owner) =>
        sendMail({
          to: owner.email,
          template,
          clubId: input.clubId,
          data: {
            clubName: clubName ?? '',
            recipientName: owner.firstName,
            panelUrl: clubPanelUrl,
            note: input.note ?? null,
          },
        }),
      ),
    )
  } catch (err) {
    logger.error({ err, clubId: input.clubId, toStatus: input.toStatus }, '[mail] failed to notify status change')
  }
}

// ---- Card #72: club team invitations ----------------------------------------

export type InvitationRole = 'admin' | 'staff'

export function roleLabel(role: InvitationRole): string {
  return role === 'admin' ? 'Administrador' : 'Recepción'
}

/** Accept link of the panel. The raw token appears here and nowhere else. */
export function buildInvitationUrl(panelUrl: string, token: string, clubId: string): string {
  const base = panelUrl.replace(/\/+$/, '')
  return `${base}/invite?token=${encodeURIComponent(token)}&club=${encodeURIComponent(clubId)}`
}

export interface NotifyTeamInvitationInput {
  clubId: string
  to: string
  role: InvitationRole
  inviterName?: string | null
  /** Raw invitation token (never logged, never stored by the mail module). */
  token: string
  expiresInDays?: number
}

/**
 * Emails the invitation link. Never throws; resolves `true` only when the
 * provider accepted the email (`sent`), so callers can report `email_sent`.
 * `log` mode and a missing key resolve `false` (nothing left the server).
 */
export async function notifyTeamInvitation(input: NotifyTeamInvitationInput): Promise<boolean> {
  try {
    const clubName = await repository.findClubName(input.clubId)
    const { clubPanelUrl } = getMailConfig()
    const result = await sendMail({
      to: input.to,
      template: 'team_invitation',
      clubId: input.clubId,
      data: {
        clubName: clubName ?? '',
        panelUrl: buildInvitationUrl(clubPanelUrl, input.token, input.clubId),
        roleLabel: roleLabel(input.role),
        inviterName: input.inviterName ?? null,
        expiresInDays: input.expiresInDays ?? null,
      },
    })
    return result.status === 'sent'
  } catch (err) {
    logger.error({ clubId: input.clubId, err: describeError(err) }, '[mail] failed to send team invitation')
    return false
  }
}

// ---- Card #74: Mercado Pago link of the club ---------------------------------

/** Link of the club's Mercado Pago screen in the panel. */
export function buildMercadoPagoPanelUrl(panelUrl: string, clubId: string): string {
  return `${panelUrl.replace(/\/+$/, '')}/${encodeURIComponent(clubId)}/mercadopago`
}

export interface NotifyMpConnectionInput {
  clubId: string
  template: 'mp_connection_expiring' | 'mp_connection_failed'
  daysLeft: number | null
  /** Internal failure code; never shown to the owner as is (the email carries no technical detail). */
  reason?: string | null
}

/**
 * Tells the club owner(s) that the Mercado Pago link is about to expire or
 * broke. Never throws; use it fire-and-forget (`void notifyMpConnectionProblem(...)`).
 */
export async function notifyMpConnectionProblem(input: NotifyMpConnectionInput): Promise<void> {
  try {
    const [clubName, owners] = await Promise.all([
      repository.findClubName(input.clubId),
      repository.findClubOwners(input.clubId),
    ])
    if (owners.length === 0) {
      logger.warn({ clubId: input.clubId, template: input.template }, '[mail] club has no owner with an email, nothing to send')
      return
    }
    const panelUrl = buildMercadoPagoPanelUrl(getMailConfig().clubPanelUrl, input.clubId)
    await Promise.all(
      owners.map((owner) =>
        sendMail({
          to: owner.email,
          template: input.template,
          clubId: input.clubId,
          data: {
            clubName: clubName ?? '',
            recipientName: owner.firstName,
            panelUrl,
            daysLeft: input.daysLeft,
          },
        }),
      ),
    )
  } catch (err) {
    logger.error({ clubId: input.clubId, template: input.template, err: describeError(err) }, '[mail] failed to notify Mercado Pago link problem')
  }
}
