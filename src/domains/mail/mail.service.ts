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
}

export interface NotifyApplicationStatusChangeInput {
  clubId: string
  toStatus: ClubStatus
  /** Reviewer notes (`changes_requested`) or reason (`rejected`). */
  note?: string | null
}

/**
 * Tells the owner(s) of a club that its application changed status. Call it
 * AFTER the status change succeeded and do not rely on its result: it never
 * throws and never fails the caller, it only logs. Statuses without a template
 * (`draft`, `suspended`) are ignored.
 *
 * Fire-and-forget usage: `void notifyApplicationStatusChange({ ... })`.
 */
export async function notifyApplicationStatusChange(input: NotifyApplicationStatusChangeInput): Promise<void> {
  try {
    const template = STATUS_TEMPLATES[input.toStatus]
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
