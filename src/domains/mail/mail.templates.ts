// Pure rendering of the transactional emails (Spanish). No I/O: `render` takes
// everything it needs, so it can be checked with a script and reused anywhere.

export const MAIL_TEMPLATES = [
  'application_received',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
  'reinstated',
  'team_invitation',
  'mp_connection_expiring',
  'mp_connection_failed',
  'refund_pending',
] as const
export type MailTemplate = (typeof MAIL_TEMPLATES)[number]

export interface TemplateData {
  clubName: string
  /** First name of the recipient, when known. */
  recipientName?: string | null
  /** URL of the club panel (the caller resolves it from `CLUB_PANEL_URL`). */
  panelUrl: string
  /** Reviewer notes (`changes_requested`), reason (`rejected`, `suspended`) or optional note (`reinstated`). */
  note?: string | null
  /** `team_invitation`: UI label of the invited role (Administrador / Recepción). */
  roleLabel?: string | null
  /** `team_invitation`: name of the person who invited. */
  inviterName?: string | null
  /** `team_invitation`: days until the link expires. */
  expiresInDays?: number | null
  /** `mp_connection_expiring`: days left of the Mercado Pago link. */
  daysLeft?: number | null
  /** `refund_pending`: how many refunds could not be completed. */
  refundCount?: number | null
  /** `refund_pending`: total owed to players, ARS. */
  refundAmount?: number | null
}

export interface RenderedMail {
  subject: string
  html: string
  text: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escaped text with line breaks preserved. */
function multiline(value: string): string {
  return escapeHtml(value.trim()).replace(/\r?\n/g, '<br>')
}

/** Header values must never carry line breaks. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** Only http(s) links are rendered as hrefs. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#'
}

interface Content {
  subject: string
  heading: string
  paragraphs: string[]
  /** Highlighted block (reviewer notes or reason). */
  callout?: { title: string; body: string }
  cta?: { label: string }
  afterCta?: string[]
}

const BRAND = 'Match Padel'

function contentFor(template: MailTemplate, data: TemplateData): Content {
  const club = singleLine(data.clubName) || 'tu club'
  const note = data.note?.trim() ? data.note.trim() : null

  switch (template) {
    case 'application_received':
      return {
        subject: `Recibimos la solicitud de ${club}`,
        heading: 'Recibimos tu solicitud',
        paragraphs: [
          `Recibimos la solicitud de alta de ${club}. Nuestro equipo la va a revisar y te avisaremos por este medio apenas tengamos novedades.`,
          'Mientras la solicitud está en revisión no se puede editar. Si necesitamos algún cambio, te lo vamos a pedir por mail.',
        ],
        cta: { label: 'Ver el estado de la solicitud' },
      }
    case 'changes_requested':
      return {
        subject: `Necesitamos cambios en la solicitud de ${club}`,
        heading: 'Necesitamos algunos cambios',
        paragraphs: [
          `Revisamos la solicitud de ${club} y necesitamos que hagas algunas correcciones antes de poder aprobarla.`,
        ],
        callout: { title: 'Notas del revisor', body: note ?? 'No se indicaron notas.' },
        cta: { label: 'Corregir la solicitud' },
        afterCta: ['Cuando termines, volvé a enviarla desde el panel y la revisamos de nuevo.'],
      }
    case 'approved':
      return {
        subject: `${club} ya está en Match Padel`,
        heading: '¡Tu club fue aprobado!',
        paragraphs: [
          `Aprobamos la solicitud de ${club}. Ya podés gestionar canchas, reservas y torneos desde el panel, y los jugadores pueden encontrar tu club en la app.`,
        ],
        cta: { label: 'Ir al panel del club' },
      }
    case 'rejected':
      return {
        subject: `Sobre la solicitud de ${club}`,
        heading: 'No pudimos aprobar tu solicitud',
        paragraphs: [`Revisamos la solicitud de ${club} y, lamentablemente, no pudimos aprobarla.`],
        callout: { title: 'Motivo', body: note ?? 'No se indicó un motivo.' },
        afterCta: ['Si creés que se trata de un error o querés más información, respondé a este mail y lo vemos.'],
      }
    case 'suspended':
      return {
        subject: `${club} fue suspendido en Match Padel`,
        heading: 'Suspendimos tu club',
        paragraphs: [
          `Suspendimos ${club} en Match Padel. Mientras esté suspendido los jugadores no lo ven en la app y no se pueden editar sus datos.`,
        ],
        callout: { title: 'Motivo', body: note ?? 'No se indicó un motivo.' },
        afterCta: ['Si querés más información o creés que se trata de un error, respondé a este mail y lo vemos.'],
      }
    case 'reinstated':
      return {
        subject: `${club} volvió a estar activo en Match Padel`,
        heading: 'Tu club volvió a estar activo',
        paragraphs: [
          `Levantamos la suspensión de ${club}. Los jugadores ya pueden volver a encontrarlo en la app y podés seguir gestionándolo desde el panel.`,
        ],
        ...(note ? { callout: { title: 'Nota', body: note } } : {}),
        cta: { label: 'Ir al panel del club' },
      }
    case 'team_invitation': {
      const role = singleLine(data.roleLabel ?? '') || 'Recepción'
      const inviter = singleLine(data.inviterName ?? '')
      const days = data.expiresInDays && data.expiresInDays > 0 ? Math.floor(data.expiresInDays) : 7
      return {
        subject: inviter ? `${inviter} te invitó a ${club} en ${BRAND}` : `Te invitaron a ${club} en ${BRAND}`,
        heading: 'Te invitaron a sumarte a un club',
        paragraphs: [
          `${inviter || 'El dueño del club'} te invitó a formar parte del equipo de ${club} en ${BRAND}.`,
          'Para aceptar, entrá con el mismo email al que llegó esta invitación: si todavía no tenés cuenta, creala desde el link y confirmá tu email.',
        ],
        callout: { title: 'Tu rol', body: role },
        cta: { label: 'Aceptar la invitación' },
        afterCta: [
          `La invitación vence en ${days} días. Si no esperabas este mail, podés ignorarlo: no se crea ningún acceso hasta que la aceptes.`,
        ],
      }
    }
    case 'mp_connection_expiring': {
      const days = data.daysLeft !== null && data.daysLeft !== undefined && data.daysLeft >= 0 ? Math.floor(data.daysLeft) : null
      const when = days === null ? 'pronto' : days === 0 ? 'hoy' : days === 1 ? 'en 1 día' : `en ${days} días`
      return {
        subject: `La cuenta de Mercado Pago de ${club} vence ${when}`,
        heading: 'Tu cuenta de Mercado Pago está por vencer',
        paragraphs: [
          `La vinculación de la cuenta de Mercado Pago de ${club} con ${BRAND} vence ${when} y no pudimos renovarla automáticamente.`,
          'Para seguir cobrando en tu cuenta, volvé a vincularla desde el panel. Solo lleva un minuto y no perdés ningún dato.',
        ],
        cta: { label: 'Volver a vincular Mercado Pago' },
        afterCta: ['Solo el dueño del club puede vincular la cuenta. Si ya lo hiciste, ignorá este mail.'],
      }
    }
    case 'refund_pending': {
      const count = data.refundCount && data.refundCount > 0 ? Math.floor(data.refundCount) : 1
      const amount =
        data.refundAmount !== null && data.refundAmount !== undefined && data.refundAmount > 0
          ? `$${data.refundAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null
      return {
        subject: `Hay ${count === 1 ? 'un reembolso pendiente' : `${count} reembolsos pendientes`} en ${club}`,
        heading: 'No pudimos completar un reembolso',
        paragraphs: [
          `Un jugador canceló su reserva en ${club} y, según la política de devoluciones del club, le corresponde un reembolso que no se pudo completar desde la cuenta de Mercado Pago del club.`,
          'La cancelación quedó registrada y el jugador fue avisado de que el reembolso está pendiente. Revisá que la cuenta del club esté vinculada y tenga saldo disponible; luego el reembolso debe resolverse con el jugador.',
        ],
        callout: {
          title: 'Reembolsos pendientes',
          body: amount ? `${count} (${amount} en total)` : String(count),
        },
        cta: { label: 'Revisar la cuenta de Mercado Pago' },
        afterCta: ['Solo el dueño del club puede vincular la cuenta de Mercado Pago.'],
      }
    }
    case 'mp_connection_failed':
      return {
        subject: `Hay que volver a vincular Mercado Pago en ${club}`,
        heading: 'La vinculación con Mercado Pago dejó de funcionar',
        paragraphs: [
          `La vinculación de la cuenta de Mercado Pago de ${club} con ${BRAND} venció o fue revocada, y no pudimos renovarla.`,
          'Hasta que la vuelvas a vincular no vamos a poder acreditar cobros en tu cuenta. Podés hacerlo desde el panel en un minuto.',
        ],
        ...(note ? { callout: { title: 'Detalle', body: note } } : {}),
        cta: { label: 'Volver a vincular Mercado Pago' },
        afterCta: ['Solo el dueño del club puede vincular la cuenta. Si ya lo hiciste, ignorá este mail.'],
      }
  }
}

export function render(template: MailTemplate, data: TemplateData): RenderedMail {
  const c = contentFor(template, data)
  const greeting = data.recipientName?.trim() ? `Hola ${data.recipientName.trim()},` : 'Hola,'
  const url = safeUrl(data.panelUrl)

  const htmlParagraph = (p: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937;">${multiline(p)}</p>`

  const calloutHtml = c.callout
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f3f4f6;border-left:4px solid #16a34a;border-radius:4px;">
        <p style="margin:0 0 6px;font-size:13px;line-height:18px;font-weight:bold;color:#374151;text-transform:uppercase;">${escapeHtml(c.callout.title)}</p>
        <p style="margin:0;font-size:16px;line-height:24px;color:#1f2937;">${multiline(c.callout.body)}</p>
      </div>`
    : ''

  const ctaHtml = c.cta
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;background:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;border-radius:6px;">${escapeHtml(c.cta.label)}</a></p>`
    : ''

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;">
  <tr><td style="padding:20px 28px;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:bold;color:#16a34a;">${BRAND}</td></tr>
  <tr><td style="padding:28px;">
    <h1 style="margin:0 0 20px;font-size:22px;line-height:28px;color:#111827;">${escapeHtml(c.heading)}</h1>
    ${htmlParagraph(greeting)}
    ${c.paragraphs.map(htmlParagraph).join('\n    ')}
    ${calloutHtml}
    ${ctaHtml}
    ${(c.afterCta ?? []).map(htmlParagraph).join('\n    ')}
  </td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;line-height:18px;color:#6b7280;">Este es un mensaje automático de ${BRAND}.</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  const textParts = [c.heading, '', greeting, '', ...c.paragraphs.flatMap((p) => [p, ''])]
  if (c.callout) textParts.push(`${c.callout.title}:`, c.callout.body, '')
  if (c.cta) textParts.push(`${c.cta.label}: ${url}`, '')
  for (const p of c.afterCta ?? []) textParts.push(p, '')
  textParts.push(`Este es un mensaje automático de ${BRAND}.`)

  return { subject: c.subject, html, text: textParts.join('\n') }
}
