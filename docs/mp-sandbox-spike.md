# Mercado Pago Marketplace sandbox spike — runbook and findings template (card #73)

Card: [Admin F3] Validar Mercado Pago Marketplace en sandbox (spike) —
<https://trello.com/c/R42lPr9n/73-admin-f3-validar-mercado-pago-marketplace-en-sandbox-spike>.
Helper: `scripts/mp-sandbox-spike.ts` (`npx tsx`, no extra dependency, not part of the build).
Code under test: `docs/mercadopago.md` (OAuth link card #74, charging card #75, partial refunds card #76).

> **Status of this document**: the runbook and the helper were prepared WITHOUT Mercado Pago credentials. Nothing in
> the "Findings" section below has been observed yet. Every line is either a current assumption to confirm or a blank
> to fill. Budget: about 1 hour for Part A (script, facts) and 30 more minutes for Part B (the real API on dev).

## 0. What this spike answers

| # | Question (card) | Where it is settled |
|---|---|---|
| Q1 | Does the marketplace fee come back or stay with the platform on a full and on a partial refund? | step 8, 9 |
| Q2 | Who bears a chargeback and how is the fee reflected? | step 11 (probably support, not sandbox) |
| Q3 | Limits or minimums for `marketplace_fee`; amount or percent in practice? | step 5 |
| Q4 | Is a commercial approval needed to operate as marketplace in production beyond activating credentials? | step 12 (panel and support) |
| Q5 | What happens on refund when the seller has no balance? | step 10 |
| Q6 | How does the webhook identify the seller and which token must query the payment? | step 6, 7 |

Plus the unverified lists of `docs/mercadopago.md` (OAuth fields, `test_token`, PKCE, `notification_url` query, partial
refunds, idempotency key): they are folded into the steps and recorded in section 4.

## 1. Safety rules (read first)

1. **Test only.** Test Marketplace app, test seller users, test buyer user, test cards. Never link a real club, never
   put a real card, never use the production Render service, the production Supabase project
   (`ebdnlrwzhthqflsbdzvu`) or the production Mercado Pago account.
2. The helper reads credentials **only from the environment of your shell** (it never loads `.env`). Tokens of test
   users also start with `APP_USR-`, so the token prefix proves nothing. Therefore:
   - every command that calls Mercado Pago needs `MP_SPIKE_CONFIRM_TEST=yes`;
   - it refuses to run if `MP_ACCESS_TOKEN` (the API's platform token) is set, if `NODE_ENV=production`, or if the
     redirect URI host is the production API (`match-padel-api.onrender.com`);
   - before any write (`preference`, `refund`) it reads `GET /users/me` with the seller token, prints id, nickname,
     `site_id`, `user_type`, masked email and `live_mode` and **aborts unless the account looks like a test user**
     (nickname starting with `TEST`, a `test_user` email, or an id you listed in `MP_SPIKE_TEST_USER_IDS` after
     checking it in the panel's "Test accounts"). Also aborts when the token response said `live_mode=true`.
3. The helper prints only non-secret fields and masked tokens. Tokens are stored in `.mp-spike.local.json` in the repo
   root (gitignored, mode 0600). Delete it when the spike is over. Do not paste tokens in the findings.
4. Part B uses the **dev** environment only (Render `match-padel-api-dev`, Supabase `match-padel-dev`, project
   `vrnonxpxksaruvsvbplt`).

## 2. Prerequisites (about 20 minutes)

### 2.1 Mercado Pago application

1. <https://www.mercadopago.com.ar/developers/panel/app> → **Create application**. Model: **Marketplace / Checkout Pro**
   (online payments, Checkout Pro). Use the platform's developer account (or a test "Integrator" account if the panel
   offers it; write down which in the findings, it matters for "where does the fee land").
2. Copy **Application ID** (`MP_APP_ID`) and **Client secret** (`MP_APP_SECRET`) from the application's credentials.
3. In the application's OAuth/Redirect URLs register **two** URLs:
   - a spike-only one the script flow lands on: `https://example.com/mp-spike-callback` (any HTTPS URL you do not run;
     you only need to read `?code=` from the address bar after the redirect);
   - for Part B, the dev API callback: `https://match-padel-api-dev.onrender.com/api/v1/mercadopago/oauth/callback`.
4. If the app has **PKCE** (Application details), note whether it is enabled. The script supports `--pkce`.
5. Webhooks of the application (Part B only): Payments topic, URL
   `https://match-padel-api-dev.onrender.com/api/v1/payments/webhook`, copy the secret (it is `MP_WEBHOOK_SECRET` on
   the dev API).

### 2.2 Test users

Panel → your application → **Test accounts** → **Create test account**. Country Argentina for all (it cannot be
changed later and buyer and seller must match).

| Account | Type | Initial money | Used for |
|---|---|---|---|
| Seller A | Seller | a generous fictional amount (e.g. 50 000) | normal charges and refunds |
| Seller B | Seller | **0 / nothing** | refund without balance (Q5), second seller (webhook identification) |
| Buyer | Buyer | any (cards are used) | pays the preferences |

Write each account's user, password and the 6-digit login code shown in the table when email verification is requested
(see "Test accounts" docs) in your password manager, not here. Use a **private window per account** (Seller A, Seller B,
Buyer) so sessions do not mix.

### 2.3 Test cards

Use the official list (numbers and cardholder names change; do not trust memory):
<https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards>. For an approved payment use a test
card with cardholder name `APRO`; `OTHE` rejects. Use any future expiry and the CVV the page lists.

### 2.4 Shell

In a **fresh** terminal (no `.env` sourced):

```bash
cd match-padel-api
unset MP_ACCESS_TOKEN            # must not be set; the helper refuses otherwise
export MP_SPIKE_CONFIRM_TEST=yes
export MP_APP_ID=...             # test Marketplace app
export MP_APP_SECRET=...
export MP_SPIKE_REDIRECT_URI=https://example.com/mp-spike-callback
# optional, after checking them in "Test accounts":
# export MP_SPIKE_TEST_USER_IDS=<sellerA id>,<sellerB id>
alias spike='npx tsx scripts/mp-sandbox-spike.ts'   # bash/zsh; or write the full command
spike --help
```

## 3. Steps, in order, with expected observations

Expected values are what the code assumes (see section 5). If reality differs, that is the finding: record it, do not
fix anything during the spike. Keep each command's output (copy it into the findings, tokens are already masked).

### Part A — script (facts about Mercado Pago)

**Step 1 — Link Seller A.**
`spike authorize-url --seller=A` (add `--pkce` if the app enforces PKCE). Open the URL in Seller A's private window,
authorize, land on `example.com/mp-spike-callback?code=...&state=...`, copy `code` (valid 10 minutes, single use), then
`spike exchange --seller=A --code=<code>`.
Observe: HTTP success; the list of response fields; `user_id`, `scope` (is `offline_access` there? is there a
`refresh_token`?), `live_mode`, `expires_in` (expected 15 552 000 s = 180 days), `public_key` presence.
If it fails, note the exact `error`/`message` and retry once with `--test-token=true` (new code needed): that settles
the `test_token` assumption.

**Step 2 — Link Seller B.** Same with `--seller=B` in Seller B's window. Observe that `user_id` differs from A's.

**Step 3 — Confirm accounts.** `spike account --seller=A` and `--seller=B`. Observe `site_id` = `MLA`, nickname starts
with `TEST`, and whether `live_mode` is reported. If the helper says "does not look like a test user" check the panel
and use `MP_SPIKE_TEST_USER_IDS`.

**Step 4 — Preference with the seller's token and a fee (the happy path).**
`spike preference --seller=A --amount=1000 --fee=100 --notification-url='https://webhook.site/<your-unique-id>?club_id=spike'`
(create a free unique URL at <https://webhook.site>; the payload has only test payment ids).
Observe: HTTP 201, `collector_id` = Seller A's user id, `client_id` = the app id, `marketplace_fee` echoed,
`init_point` / `sandbox_init_point`. Note which of the two URLs works with test users.

**Step 5 — Fee limits matrix (Q3).** Create one preference per row (A's token, amount 1000). Record whether the
**preference** is created and, for the rows marked "pay", what the **payment** does when the Buyer pays it (a fee can be
accepted at preference time and refused at payment time).

| Row | Command flags | Pay? |
|---|---|---|
| fee omitted | `--amount=1000` | no |
| zero | `--fee=0` | no |
| minimum | `--fee=0.01` | yes |
| 1% | `--fee=10` | no |
| 10% (what the API sends at 10%) | `--fee=100` | yes (step 6) |
| 50% | `--fee=500` | yes |
| 100% of the amount | `--fee=1000` | yes |
| above the amount | `--fee=1500` | yes |
| negative | `--fee=-1` | no |
| 3 decimals | `--fee=10.005` | no |

Also try a tiny amount: `--amount=1 --fee=0.5` and `--amount=10 --fee=100`. To settle amount vs percent, compare the
`--fee=10` row (1% if it is an amount, 10% of 1000 if it were a percent) with the `fee_details` of its payment. Then compute from the results whether
the unit is an amount (`fee_details` shows the same number you sent) or a percent (it shows `amount x fee / 100`).

**Step 6 — Pay, and read the payment with three tokens (Q6).** Open the step 4 `init_point` as the Buyer, pay with the
approved test card. Take the payment id (from the result page URL, `payment_id` / `collection_id`, or the webhook.site
capture). Then:

```bash
spike payment --id=<mp payment id> --seller=A      # the collecting seller's token
spike payment --id=<mp payment id> --seller=B      # a different seller's token
spike payment --id=<mp payment id> --seller=app    # the application's own client_credentials token
```

Observe, for each token, the HTTP status (200 / 403 / 404). On the 200: `transaction_amount` (gross, expected 1000, not
reduced), `collector_id` (A's id), `fee_details` entries and their `type` (expected one with
`application_fee` = 100, plus MP's own `mercadopago_fee`), `net_received_amount`, `money_release_date`,
`money_release_status`, any top-level field with "fee" in its name (printed under `fee_fields_top_level`),
`application_id`/`sponsor_id`. Add `--raw` once to see every field.
Then repeat step 4 and 6 for **Seller B** (`--seller=B`, new preference, pay) to confirm the shape is the same for both.

**Step 7 — Webhook (Q6).** Open the webhook.site capture of the payments of steps 4–6 and run `spike webhook-sample`
for the checklist. Observe: body fields (`user_id`? `application_id`? `live_mode`, `type`, `action`, `data.id`);
whether the URL kept `?club_id=spike` and appended `data.id` and `type` with `&`; headers `x-signature` and
`x-request-id`. If **no notification arrives** for payments made with test users, record it (the docs say payments with
test credentials may send none) and cover it in Part B with the app's "Simulate" tool.

**Step 8 — Full refund (Q1).** On the Seller A payment of step 6:
`spike balance --seller=A` (record, or read the balance in A's MP web UI) and the same for the app owner/integrator
account in its UI, then `spike refund --id=<id> --seller=A` (no `--amount` = full refund, no body, no idempotency key,
exactly what the API does). The helper prints the refund and re-reads the payment. Observe: HTTP status, refund `status`
and `amount` (1000), payment `status` (`refunded`), `transaction_amount_refunded`, `refunds[]`, whether
`fee_details` still lists the `application_fee`, and the balance movements of Seller A and of the app owner **in the web
UIs**: did the platform's 100 go back, stay, or become negative on the platform side?

**Step 9 — Partial refunds (Q1, card #76).** New payment: `preference --seller=A --amount=1000 --fee=100`, pay it.
Then, reading the payment after each (the helper does it):

1. `spike refund --id=<id> --seller=A --amount=250` — accepted? payment stays `approved`? `transaction_amount_refunded`
   = 250? `fee_details`/balances: was 25 (proportional) or 0 or 100 of the fee returned?
2. same again `--amount=250` — second partial accepted?
3. `--amount=2000` — the exact error for above-the-payment (the API already maps this to a 400 before calling MP).
4. `--amount=500` — the remainder: does the payment become `refunded`?
5. repeat step 1 on a fresh payment with `--idempotency-key=spike-1` **twice**: is the second call a no-op (same
   refund id) or a second refund? Then without a key twice in a row: do two refunds go through? (Idempotency question of
   `docs/mercadopago.md`, matters for two concurrent cancellations.)

**Step 10 — Seller without balance (Q5).** Seller B has no money. Pay a preference of B (amount 1000, fee 100) and
immediately `spike refund --id=<id> --seller=B` and `--amount=250`. Record the exact HTTP status and the body
(`error`, `message`, `cause`) — that is what `payments.refund_error` would keep as `MP_REFUND_REJECTED:<status>` —
and whether it is a status the API should treat as retryable. If the refund goes through anyway (balance unreleased,
`money_release_status`), also record `money_release_date` and note that the no-balance case needs Mercado Pago's
answer. If the web UI lets you move money out of Seller B's test account, empty it and try again.

**Step 11 — Chargeback (Q2).** Look in the test cards / testing docs for a way to simulate a dispute or
chargeback on a sandbox payment. If there is none, do not invent one: record "not simulable" and ask Mercado Pago
support (questions in section 6). If a chargeback can be produced, read the payment with `payment --raw`
(`status = charged_back`, `status_detail`, fee fields) and both balances.

**Step 12 — Commercial approval (Q4).** In the application panel open the production credentials activation page
and write down every requirement it lists (industry, website, terms and conditions, business data, anything about
"marketplace" or "split payments" needing review). Check the application's page for a marketplace/OAuth review or
"integration quality" step. Anything not explicit goes to support (section 6).

### Part B — the real API on dev (the app's own code against Mercado Pago)

Part A answers Mercado Pago's behaviour. Part B proves our code reads those answers correctly. Use the dev API.

**Step 13 — Configure dev.** On Render `match-padel-api-dev` (human only) set `MP_APP_ID`, `MP_APP_SECRET`,
`MP_OAUTH_REDIRECT_URI` (the dev callback registered in 2.1), `MP_TOKEN_ENCRYPTION_KEY` (32 random bytes base64,
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `MP_WEBHOOK_SECRET`, `API_URL`,
`MP_ACCESS_TOKEN` = the **test** credentials access token of the app (the platform charge path), `CLUB_PANEL_URL`.
Do not reuse the production values.

**Step 14 — Link a dev club.** In the dev panel (or `POST /club-admin/:clubId/mercadopago/connect`) as the club's owner,
get `authorization_url`, open it in **Seller A's** window, authorize, you are redirected to the dev callback
(`.../mercadopago/oauth/callback`). Use a fresh authorization (codes are single use). Observe the 302 to the panel with
`status=connected` or an `error`+`reason`; then `GET /club-admin/:clubId/mercadopago` (`connected`, `mp_user_id`,
`live_mode`, `days_left`).

**Step 15 — Commission and charge.** As superadmin: `PATCH /platform/clubs/:clubId/commission` with 10 and
`PATCH .../collection-mode` `club_account`. As a player: create a reservation (price 1000) and
`POST /payments/preference`. Pay as the Buyer with the approved test card. Observe the webhook arriving at dev
(Render logs: no `Ignored MercadoPago webhook`, no `amount mismatch`).

**Step 16 — Refunds through the API.** Club cancels the reservation (`POST /club-admin/:clubId/reservations/:id/cancel`,
100%). Then a second paid reservation cancelled by the player inside the late window with `refund_policy` of the club
at 50% (`PUT /club-admin/:clubId/refund-policy`, `late_refund_percent: 50`, `hours_before_start` large enough to be
inside the window): partial refund of 500. Third: Seller B linked to a second club, charge, then cancel to see
`refund_status = 'pending'`.

**Step 17 — Read the results in the app's own tables** (dev Supabase SQL editor, project `vrnonxpxksaruvsvbplt`
only):

```sql
-- the charge and what the API stored from the webhook
select id, status, amount, commission_percent, marketplace_fee, net_amount, collected_via,
       seller_mp_user_id, mp_payment_id, mp_event_id, refund_status, refunded_amount, refund_error,
       metadata, created_at
from payments order by created_at desc limit 10;

-- the link: which MP user, live_mode, expiry, last error
select club_id, mp_user_id, status, live_mode, scope, expires_at, last_refresh_at, last_error
from club_mp_accounts;

-- emails sent (refund_pending, mp_connection_*)
select created_at, template, status, error, club_id from email_log order by created_at desc limit 20;

-- audit trail (club.mp_connected, club.commission_changed, reservation.cancelled_by_club, ...)
select created_at, action, entity, entity_id, metadata from audit_log order by created_at desc limit 20;
```

Compare with Part A for the same payment: is `marketplace_fee` equal to the `application_fee` Mercado Pago reports
(the webhook logs a `warn` "reported a marketplace fee different from the one sent" if not), and is `net_amount` what
the seller really received minus Mercado Pago's own fee (it is `amount - marketplace_fee` by design)?

## 4. Question → how to observe → what to record

| Question | How to observe | What to record |
|---|---|---|
| Fee on full refund (Q1) | step 8: `refund` full, then `payment`, both balances in the web UIs | refund HTTP status; fee returned to seller / kept by platform / platform negative; `fee_details` after; who funded the refund; balance deltas of A and of the app owner |
| Fee on partial refund (Q1) | step 9.1–9.4 | fee returned per partial (proportional? none? all?); whether the fee is reduced in `fee_details`; final status after the remainder |
| Chargeback (Q2) | step 11, support | simulable yes/no; status and fee fields; who is debited (seller, platform, both); is the fee clawed back; notification type/action (`chargebacks` topic?) |
| Fee limits (Q3) | step 5 matrix | per row: preference result and payment result (HTTP, `message`); min and max accepted; unit (amount or percent) proven by `fee_details` |
| Commercial approval (Q4) | step 12, support | list of panel requirements; whether anything specific to marketplace exists; lead time; contact and date of the answer |
| Refund without balance (Q5) | step 10 | HTTP status and `error`/`message`/`cause` of the refusal, or "accepted" plus `money_release_status`; retryable or not |
| Webhook seller + token (Q6) | step 6 (three tokens), step 7 | which tokens answer 200/403/404; body fields identifying the seller (`user_id`/`application_id`/`collector_id`); `club_id` query kept; signature secret shared between sellers |
| `test_token` | step 1 | which value worked; whether the token differs |
| PKCE | step 1 | enforced or optional; `--pkce` worked |
| Refresh token | step 1 | present; `expires_in` |
| Idempotency on refunds | step 9.5 | key needed? second call duplicate? |
| Notifications for refunds | step 7 | a notification per refund? which `action`? |

## 5. Findings template

Copy this section into a new file (or a new section) when running the spike. Leave nothing blank: write "not
observed" with the reason. Date, who ran it, app id, seller user ids (not secrets), country.

Run: `____-__-__` by `______`. App created under: `real account | integrator test account`. PKCE: `on | off`.

### 5.1 Observations per question

| # | Question | Assumption in code/docs | Observed | Evidence (command, HTTP, id) | Confirmed? |
|---|---|---|---|---|---|
| Q1a | Fee on a FULL refund | Unknown (open question in the scope document); the code does not recompute `marketplace_fee`/`net_amount` after a refund and never refunds the fee separately | | | yes / no / partly |
| Q1b | Fee on a PARTIAL refund | Unknown; the API sends `{ amount }` only, payment stays `approved`, `metadata.partial_refunds` appended | | | |
| Q2 | Chargeback: who bears it, fee | Not modelled anywhere (no chargeback handling, no webhook branch for it) | | | |
| Q3a | `marketplace_fee` is an amount | Amount in transaction currency, sent as `round(amount x pct / 100, 2)`, omitted at 0 | | | |
| Q3b | Minimum / maximum fee | Any value in `[0.01, amount]`; clamped to the amount by the API | | | |
| Q4 | Commercial approval beyond credentials | Only credential activation (industry, website, terms) and the club's KYC | | | |
| Q5 | Refund when the seller has no balance | Refused by MP with some HTTP error; API records `pending` + `MP_REFUND_REJECTED:<status>`, no automatic retry | | | |
| Q6a | Seller identification in the webhook | `?club_id=` of our own `notification_url` selects the token; body not used for the seller; `collector_id` of the fetched payment compared with `seller_mp_user_id` | | | |
| Q6b | Token to read the payment | The seller's token (404/401 with another) | | | |
| Q6c | Signature secret | One `MP_WEBHOOK_SECRET` (the app's) for sellers' payments too, `data.id` lowercased in the manifest | | | |

### 5.2 Other assumptions from `docs/mercadopago.md`

| Assumption | Observed | Confirmed? |
|---|---|---|
| Authorization host `auth.mercadopago.com` works for Argentina (no `.com.ar` needed) | | |
| Token response has `access_token`, `refresh_token`, `expires_in`, `user_id`, `public_key`, `scope`, `live_mode` | | |
| `test_token: false` is right for test users (or `true` is required) | | |
| Expired/revoked refresh token answers 400/401 `invalid_grant` | not testable quickly; note if seen | |
| Refresh response repeats `user_id`/`public_key`/`live_mode` | | |
| A refresh still works after the access token lapsed | not testable in an hour | |
| `error=access_denied` on a denied authorization | | |
| `notification_url` with its own query keeps `club_id` and gets `&data.id=...&type=...` | | |
| Payment fields: `collector_id` = seller user id; `fee_details[].type = 'application_fee'`; `transaction_amount` is gross | | |
| `back_urls`/`auto_return: approved` behave like the platform account | | |
| Partial refund `{ amount }` accepted for a marketplace payment; several partials accepted | | |
| A refund needs no `X-Idempotency-Key` | | |
| A payment of a seller can only be read with that seller's token | | |
| Test users' payments send webhooks | | |

### 5.3 Design decisions that would change

Pre-seeded with what the code does today. Mark each `Confirmed` (nothing changes) or `Changes` (write the new
decision and the card to open).

| # | Current decision (where) | Becomes true/false depending on | Confirmed / Changes (to what) | Follow-up card |
|---|---|---|---|---|
| D1 | `marketplace_fee = round(amount x commission_percent / 100, 2)`, omitted at 0, clamped to the amount (`charging.core.ts`) | Q3 | | |
| D2 | Commission is an amount in ARS frozen on the row; the webhook overwrites it with the reported `application_fee` | Q3, step 17 | | |
| D3 | `net_amount = amount - marketplace_fee`, before Mercado Pago's own fee, not shown to the club as what it receives | `fee_details`, `net_received_amount` | | |
| D4 | A full refund sets the payment `refunded` and the code assumes nothing about the fee; reports (`GET /club-admin/:clubId/payments` totals) only add `approved` payments | Q1a | | |
| D5 | A late-window partial refund is computed on what the player paid; the platform fee is not recomputed on the row | Q1b | | |
| D6 | Policy partial refunds always come from the club's account with the club token (`collected_via = 'club'`) | Q1, Q5 | | |
| D7 | A refund that MP rejects leaves the payment `approved`, `refund_status = 'pending'`, notifies the owners, no automatic retry | Q5 (status/body, retryable?) | | |
| D8 | No chargeback handling at all; no field, no webhook branch, no email | Q2 | | |
| D9 | The webhook trusts `?club_id=` only to choose the token and always re-validates against the `payments` row and `collector_id` | Q6a, Q6c | | |
| D10 | The payment is read with the seller's token (club) or the platform token, never with the app's | Q6b | | |
| D11 | One webhook secret (`MP_WEBHOOK_SECRET`) verifies platform and seller notifications | Q6c | | |
| D12 | The OAuth exchange sends `test_token: false`; PKCE is off unless `MP_OAUTH_PKCE=true` | step 1 | | |
| D13 | Refunds are sent without `X-Idempotency-Key`; two concurrent cancellations are not serialized | step 9.5 | | |
| D14 | Going live needs credential activation + club KYC only; nothing else is scheduled | Q4 | | |
| D15 | Partial-refund policy (`late_refund_percent`) is offered to clubs without further limits | Q1b, Q3 | | |

### 5.4 Bugs or doc fixes found

List code or documentation corrections the spike exposes (file, line, what). Open one card each; the spike itself
changes no code.

## 6. Questions for Mercado Pago support / the account executive

Send what the sandbox could not settle. Suggested text (Spanish is fine, keep the app id):

1. In a Checkout Pro marketplace payment with `marketplace_fee`, on a full and on a partial refund, is the fee
   returned to the seller, kept by the marketplace or reduced proportionally? Who funds the refund when the seller
   has no available balance?
2. On a chargeback, who is debited (seller, marketplace) and is the `marketplace_fee` reversed? Is there a
   notification topic we can subscribe to, and a way to simulate one in the sandbox?
3. Minimum and maximum accepted `marketplace_fee` (amount) in ARS, and per-payment limits.
4. Besides activating production credentials and each seller's account verification, does operating as a marketplace
   in Argentina require a commercial agreement or review? Is the commission subject to any contract?
5. Is the 180-day access token plus rotating refresh token the same in production? What happens to a seller's
   tokens if their account is blocked or they revoke the app?

## 7. Cleanup

- Delete `.mp-spike.local.json` (`rm .mp-spike.local.json`) and unset the environment variables.
- Revoke the test sellers' authorization of the app in their MP account if you will reuse them.
- Delete or reset the dev club's `club_mp_accounts` row with `DELETE /club-admin/:clubId/mercadopago`.
- Put the findings (section 5) in this file or in a new `docs/mp-sandbox-findings.md`, update the "Unverified" lists of
  `docs/mercadopago.md` and the "Real state vs. target" rows of `CLAUDE.md` that say "not verified against the
  sandbox", and attach it to the Trello card.

## 8. Sources used to prepare the runbook

Public Mercado Pago documentation (Argentina site), read while preparing this document; the details marked as
assumptions above were not stated there:

- Integrate marketplace, Checkout Pro (`marketplace_fee` on `/checkout/preferences`, seller access token):
  <https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/how-tos/integrate-marketplace.md>
- Split payments, integrate marketplace (refund split proportionally between seller and marketplace; 1:1 model cannot
  fully refund without seller funds): <https://www.mercadopago.com.ar/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace>
- OAuth, authorization code flow (authorization URL, `test_token`, 10-minute code, 180-day token, `client_credentials`):
  <https://www.mercadopago.com.ar/developers/en/docs/security/oauth/creation>
- Test accounts (seller/buyer/integrator, same country, fictional money):
  <https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/accounts>
- Notifications / webhooks (payload fields, per-preference `notification_url` takes precedence, test credentials send no
  notifications): <https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications>
- Cancellations and refunds (180 days, available balance required, partial refunds supported):
  <https://www.mercadopago.com.ar/developers/en/docs/sales-processing/cancellations-and-refunds>
- Test cards: <https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards>

Not found in the public documentation at preparation time: chargeback treatment of the marketplace fee, fee limits,
commercial approval requirements, the exact error of a refund without balance. They stay open until observed.
