# Transactional email — match-padel-api

Introduced by card #69 (`[Admin F1]`). Code: `src/domains/mail/` (templates, service, repository) and
`src/lib/resend.ts` (the Resend client). Provider: [Resend](https://resend.com) through the `resend` npm package.

## Principles

- **Never breaks the operation that triggered it.** `sendMail` and `notifyApplicationStatusChange` never throw: every
  failure is logged (`[mail] ...`) and recorded. Callers use them fire-and-forget (`void notify...(...)`) after the
  main operation succeeded.
- **Every attempt is recorded** in `email_log` (`to_email`, `template`, `club_id`, `status` = `sent` | `failed` |
  `skipped`, `provider_id`, `error`). RLS is enabled with no policies: API only. `skipped` means "log" mode or no key.
- **Rendering is pure**: `render(template, data)` returns `{ subject, html, text }`, Spanish, every interpolated value
  escaped, no I/O.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `RESEND_API_KEY` | none | Resend API key (server only). |
| `MAIL_FROM` | `Match Padel <no-reply@matchpadel.com.ar>` | Sender. Its domain must be verified in Resend. |
| `MAIL_MODE` | `send` if there is a key, else `log` | `send` calls Resend; `log` only logs the email and records it as `skipped`. `send` without a key is recorded as `skipped` too. |
| `APP_ENV` | falls back to `NODE_ENV` | Outside `production`, every subject is prefixed `[DEV]`. |
| `MAIL_DEV_RECIPIENT` | none | Outside production, every email goes to this address; the original recipient is added at the bottom of the body. |
| `CLUB_PANEL_URL` | `https://match-padel-admin.vercel.app` | Link used in the emails. |

Note on `APP_ENV`: Render services usually run with `NODE_ENV=production` even in dev. Set `APP_ENV=development` on the
dev service so mail behaves as non-production.

## Modes

| Situation | Behavior |
|---|---|
| No `RESEND_API_KEY` (local, CI) | `log` mode: nothing is sent, `email_log.status = 'skipped'` |
| Key set, `MAIL_MODE` unset | `send` |
| `MAIL_MODE=log` with key | Nothing is sent (kill switch) |
| Non-production + `MAIL_DEV_RECIPIENT` | Sent only to that address, subject `[DEV] ...` |
| Non-production, no `MAIL_DEV_RECIPIENT` | Sent to the real recipient with `[DEV]` prefix: set the variable in dev |

## Templates

| Template | Sent when | Data |
|---|---|---|
| `application_received` | the owner submits the application (`pending`) | club name |
| `changes_requested` | a reviewer asks for corrections | `note` = reviewer notes |
| `approved` | the application is approved | club name |
| `rejected` | the application is rejected | `note` = reason |
| `suspended` | a superadmin suspends an approved club | `note` = reason |
| `reinstated` | a superadmin lifts the suspension (`suspended` to `approved`) | `note` = optional note |
| `mp_connection_expiring` | the daily Mercado Pago renewal failed and the link still has days left (card #74). At most once every 7 days per club | `clubName`, `daysLeft`, `panelUrl` = `<CLUB_PANEL_URL>/<clubId>/mercadopago` |
| `mp_connection_failed` | the Mercado Pago link expired or was revoked and cannot be renewed (card #74). Once, when it breaks | `clubName`, `panelUrl` as above |
| `refund_pending` | a player's refund (per the club's refund policy, card #76) could not be completed from the club's Mercado Pago account: link expired, no balance, or Mercado Pago rejected it. One email per cancellation to every owner | `clubName`, `refundCount`, `refundAmount` (total owed, ARS), `panelUrl` = `<CLUB_PANEL_URL>/<clubId>/mercadopago` |
| `team_invitation` | the owner invites a person to the club team (card #72), and on resend | `clubName`, `roleLabel` (Administrador / Recepción), `inviterName`, `expiresInDays`, `panelUrl` = the accept link |

`notifyApplicationStatusChange({ clubId, toStatus, note })` (exported from `mail.service.ts`) resolves the owners of the
club (`club_staff.role = 'owner'`, email from the Supabase auth admin API), picks the template for `toStatus` and sends
one email per owner. `draft` has no template and is ignored. `fromStatus` is optional but needed to tell a reinstatement (`suspended` to
`approved`, template `reinstated`) from a first approval (`approved`); `templateForStatusChange(from, to)` is the pure
rule. Callers: `submit` (`pending`), and the platform review/suspend actions (card #68), after the transition and the
history entry succeeded.

`notifyTeamInvitation({ clubId, to, role, inviterName, token, expiresInDays })` (card #72) builds the accept link with
`buildInvitationUrl` (`${CLUB_PANEL_URL}/invite?token=...&club=<clubId>`), sends it and resolves `true` only when the
provider accepted the email (`false` in `log` mode, without a key or on failure; it never throws). The raw token is
only in the email body: `email_log` records no body and the logger never receives it. In non-production with
`MAIL_DEV_RECIPIENT` the link goes to that mailbox.

`notifyRefundPending({ clubId, count, amount })` (card #76, `mail.service.ts`) sends `refund_pending` to every owner of the club. It never throws and is called by the refund policy core (`src/domains/payments/refund-policy.core.ts`, wired in `payment.service.ts`) after the cancellation went through; the in-app notification to the owners (`type: system`, `data.kind = 'refund_pending'`) is created next to it and neither blocks the other.

`notifyMpConnectionProblem({ clubId, template, daysLeft, reason })` (card #74, `mail.service.ts`) sends the two
Mercado Pago templates to every owner of the club. It never throws and is called fire-and-forget by the renewal logic
(`src/domains/club-mercadopago/club-mercadopago.core.ts`); the email carries no technical detail or token.

## Adding a template

1. Add its key to `MAIL_TEMPLATES` and a `case` in `contentFor` in `mail.templates.ts` (subject, heading, paragraphs,
   optional callout and call to action). The compiler flags the missing case.
2. If it is tied to a status, add it to `STATUS_TEMPLATES` in `mail.service.ts`; otherwise call `sendMail({ to,
   template, data, clubId })` directly.
3. Check it with a throwaway `npx tsx` script that renders it with hostile values (`<script>`, quotes, newlines).
4. No migration needed: `email_log.template` is free text.

## What the human must configure

1. **Resend**: the domain `matchpadel.com.ar` is already verified for sending (per the card). Create an API key
   restricted to sending (one per environment is recommended) and keep it only in Render.
2. **Render dev** (`match-padel-api-dev`): `RESEND_API_KEY` (a key restricted to sending), `APP_ENV=development`,
   `MAIL_DEV_RECIPIENT=<a mailbox you control>`, optionally `CLUB_PANEL_URL` with the dev admin URL
   (`https://match-padel-admin-git-develop-agusshadows-projects.vercel.app`).
3. **Render production** (`match-padel-api`): `RESEND_API_KEY`, optionally `MAIL_FROM` and `CLUB_PANEL_URL`. Do not set
   `MAIL_DEV_RECIPIENT`. The `email_log` migration must reach production with the release first (the code logs and
   continues if the table is missing, but nothing would be recorded).
