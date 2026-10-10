// Pure rendering of the transactional emails (Spanish). No I/O: `render` takes
// everything it needs, so it can be checked with a script and reused anywhere.

export const MAIL_TEMPLATES = ['application_received', 'changes_requested', 'approved', 'rejected'] as const
export type MailTemplate = (typeof MAIL_TEMPLATES)[number]

export interface TemplateData {
  clubName: string
  /** First name of the recipient, when known. */
  recipientName?: string | null
  /** URL of the club panel (the caller resolves it from `CLUB_PANEL_URL`). */
  panelUrl: string
  /** Reviewer notes (`changes_requested`) or reason (`rejected`). */
  note?: string | null
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
