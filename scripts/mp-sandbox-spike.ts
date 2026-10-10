/**
 * Mercado Pago Marketplace sandbox spike helper (card #73).
 *
 * Run with `npx tsx scripts/mp-sandbox-spike.ts <command> [--flags]`. See docs/mp-sandbox-spike.md.
 *
 * Standalone on purpose: no import from `src/` (so no singleton, no app boot) and no new dependency.
 * It is NOT part of the build (the root tsconfig only includes `src/`).
 *
 * Safety:
 *  - Reads credentials ONLY from the environment of the shell it runs in (it never loads a .env file).
 *  - Every command that touches Mercado Pago requires MP_SPIKE_CONFIRM_TEST=yes.
 *  - Refuses to run when MP_ACCESS_TOKEN (the API's platform token) is set, when NODE_ENV=production
 *    or when the redirect URI points at the production API host.
 *  - Before any write call (preference, refund) it reads the seller's account and aborts unless it
 *    looks like a Mercado Pago TEST user (or its id is listed in MP_SPIKE_TEST_USER_IDS).
 *  - Prints only non-secret fields and masked tokens. Tokens are written to `.mp-spike.local.json`
 *    (gitignored, mode 0600).
 */
import { createHash, randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { resolve } from 'path'

const MP_API = 'https://api.mercadopago.com'
const AUTH_URL = 'https://auth.mercadopago.com/authorization'
const TOKEN_FILE = resolve(process.cwd(), '.mp-spike.local.json')
const PRODUCTION_API_HOSTS = ['match-padel-api.onrender.com']

type Seller = 'A' | 'B'

interface StoredAccount {
  access_token: string
  refresh_token: string | null
  user_id: string | null
  public_key: string | null
  scope: string | null
  live_mode: boolean | null
  expires_in: number | null
  obtained_at: string
  test_token_flag: string
}

interface Pending {
  state: string
  code_verifier: string | null
  redirect_uri: string
  created_at: string
}

interface Store {
  accounts: Partial<Record<Seller, StoredAccount>>
  pending: Partial<Record<Seller, Pending>>
}

// ---- output helpers ---------------------------------------------------------

function out(line = ''): void {
  process.stdout.write(`${line}\n`)
}

function fail(message: string, code = 1): never {
  process.stderr.write(`ERROR: ${message}\n`)
  process.exit(code)
}

function mask(value: string | null | undefined): string {
  if (!value) return '(none)'
  if (value.length <= 12) return '***'
  return `${value.slice(0, 8)}...${value.slice(-4)} (len ${value.length})`
}

function maskEmail(value: unknown): string {
  if (typeof value !== 'string' || !value.includes('@')) return '(none)'
  const [local, domain] = value.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

function printJson(label: string, obj: unknown): void {
  out(`${label}:`)
  out(
    JSON.stringify(obj, null, 2)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
  )
}

const SECRET_KEY = /token|secret|password|authorization|api[_-]?key/i

/** Deep copy with every secret-looking key replaced. Used by --raw. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[redacted]' : redact(v)]),
    )
  }
  return value
}

// ---- args and environment -----------------------------------------------------

interface Args {
  command: string
  flags: Record<string, string | true>
}

function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv
  const flags: Record<string, string | true> = {}
  for (const token of rest) {
    if (!token.startsWith('--')) fail(`Unexpected argument "${token}". Use --name=value.`)
    const eq = token.indexOf('=')
    if (eq === -1) flags[token.slice(2)] = true
    else flags[token.slice(2, eq)] = token.slice(eq + 1)
  }
  return { command, flags }
}

function strFlag(flags: Args['flags'], name: string): string | undefined {
  const v = flags[name]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function reqFlag(flags: Args['flags'], name: string): string {
  const v = strFlag(flags, name)
  if (!v) fail(`Missing --${name}=...`)
  return v
}

function reqSeller(flags: Args['flags']): Seller {
  const v = strFlag(flags, 'seller')?.toUpperCase()
  if (v !== 'A' && v !== 'B') fail('--seller must be A or B')
  return v
}

function reqNumber(flags: Args['flags'], name: string): number {
  const raw = reqFlag(flags, name)
  const n = Number(raw)
  if (!Number.isFinite(n)) fail(`--${name} must be a number (got "${raw}")`)
  return n
}

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

function redirectUri(flags: Args['flags']): string {
  const uri = strFlag(flags, 'redirect') ?? env('MP_SPIKE_REDIRECT_URI') ?? env('MP_OAUTH_REDIRECT_URI')
  if (!uri) fail('Set MP_SPIKE_REDIRECT_URI (or MP_OAUTH_REDIRECT_URI) or pass --redirect=. It must match a Redirect URL registered in the app.')
  try {
    const host = new URL(uri).host.toLowerCase()
    if (PRODUCTION_API_HOSTS.includes(host)) {
      fail(`The redirect URI points at the production API host (${host}). The spike must not use it. Register a spike-only redirect URL.`, 2)
    }
  } catch {
    fail(`Redirect URI is not a valid URL: ${uri}`)
  }
  return uri
}

/** Guards shared by every command that talks to Mercado Pago. */
function assertSafeEnvironment(): void {
  if (env('MP_ACCESS_TOKEN')) {
    fail(
      'MP_ACCESS_TOKEN is set in this shell. That is the API\'s platform token (possibly production). ' +
        'Run `unset MP_ACCESS_TOKEN` and use a clean shell for the spike.',
      2,
    )
  }
  if (env('NODE_ENV')?.toLowerCase() === 'production') fail('NODE_ENV=production is set. Refusing to run.', 2)
  if (env('MP_SPIKE_CONFIRM_TEST') !== 'yes') {
    fail(
      'Set MP_SPIKE_CONFIRM_TEST=yes to confirm you are using a TEST Marketplace app and TEST users only. ' +
        'Tokens of test users also start with APP_USR-, so the token prefix cannot tell test from live.',
      2,
    )
  }
}

// ---- local token store ------------------------------------------------------

function loadStore(): Store {
  if (!existsSync(TOKEN_FILE)) return { accounts: {}, pending: {} }
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as Partial<Store>
    return { accounts: parsed.accounts ?? {}, pending: parsed.pending ?? {} }
  } catch {
    fail(`${TOKEN_FILE} is not valid JSON. Delete it and link the sellers again.`)
  }
}

function saveStore(store: Store): void {
  writeFileSync(TOKEN_FILE, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  chmodSync(TOKEN_FILE, 0o600)
}

function accountFor(seller: Seller): StoredAccount {
  const acc = loadStore().accounts[seller]
  if (!acc) fail(`Seller ${seller} is not linked yet. Run authorize-url and exchange first.`)
  return acc
}

// ---- HTTP -----------------------------------------------------------------------

interface HttpResult {
  status: number
  body: Record<string, unknown> | null
}

async function http(
  method: 'GET' | 'POST',
  url: string,
  opts: { token?: string; json?: Record<string, unknown>; headers?: Record<string, string> } = {},
): Promise<HttpResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(opts.json ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...opts.headers,
      },
      ...(opts.json ? { body: JSON.stringify(opts.json) } : {}),
      signal: controller.signal,
    })
    let body: Record<string, unknown> | null = null
    try {
      const parsed: unknown = await res.json()
      body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      body = null
    }
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

/** Safe summary of an error body: Mercado Pago error bodies carry no secrets, but cap the size anyway. */
function errorSummary(res: HttpResult): unknown {
  if (!res.body) return null
  const { error, message, status, cause } = res.body
  return { error, message, status, cause: Array.isArray(cause) ? cause.slice(0, 5) : cause }
}

function printHttpFailure(label: string, res: HttpResult): void {
  out(`${label}: HTTP ${res.status}`)
  printJson('  error body (safe fields)', errorSummary(res))
}

// ---- account guard ------------------------------------------------------------------

interface AccountInfo {
  id: string
  nickname: string
  siteId: string
  userType: string
  email: string
  looksLikeTest: boolean
  reason: string
}

async function readAccount(token: string): Promise<AccountInfo | null> {
  const res = await http('GET', `${MP_API}/users/me`, { token })
  if (res.status !== 200 || !res.body) {
    printHttpFailure('GET /users/me', res)
    return null
  }
  const b = res.body
  const id = String(b.id ?? '')
  const nickname = String(b.nickname ?? '')
  const email = typeof b.email === 'string' ? b.email : ''
  const allow = (env('MP_SPIKE_TEST_USER_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  let looksLikeTest = false
  let reason = 'nickname and email do not look like a Mercado Pago test user'
  if (allow.includes(id)) {
    looksLikeTest = true
    reason = 'id is listed in MP_SPIKE_TEST_USER_IDS'
  } else if (/^test/i.test(nickname)) {
    looksLikeTest = true
    reason = 'nickname starts with TEST'
  } else if (/test_?user/i.test(email)) {
    looksLikeTest = true
    reason = 'email looks like a test user email'
  }
  return { id, nickname, siteId: String(b.site_id ?? ''), userType: String(b.user_type ?? ''), email, looksLikeTest, reason }
}

function printAccount(label: string, a: AccountInfo, liveMode: boolean | null): void {
  out(`${label}`)
  out(`  user id      : ${a.id}`)
  out(`  nickname     : ${a.nickname}`)
  out(`  site_id      : ${a.siteId}`)
  out(`  user_type    : ${a.userType}`)
  out(`  email        : ${maskEmail(a.email)}`)
  out(`  live_mode    : ${liveMode === null ? '(not reported by the token response)' : String(liveMode)}`)
  out(`  looks like a test user: ${a.looksLikeTest ? 'yes' : 'NO'} (${a.reason})`)
}

/** Reads the seller's account and aborts unless it is a test account. Run before every write call. */
async function guardSellerAccount(seller: Seller): Promise<StoredAccount> {
  const acc = accountFor(seller)
  const info = await readAccount(acc.access_token)
  if (!info) fail('Could not read the seller account; refusing to make a write call.', 2)
  printAccount(`Seller ${seller} account`, info, acc.live_mode)
  if (acc.live_mode === true) fail('The token response said live_mode=true. Refusing: this looks like a real account.', 2)
  if (!info.looksLikeTest) {
    fail(
      `Seller ${seller} (id ${info.id}) does not look like a test user. Refusing to make a write call. ` +
        'If the Mercado Pago panel lists this id as a test account, export MP_SPIKE_TEST_USER_IDS=<id> and retry.',
      2,
    )
  }
  if (acc.user_id && acc.user_id !== info.id) {
    fail(`Stored user_id ${acc.user_id} differs from /users/me id ${info.id}. Link the seller again.`, 2)
  }
  out()
  return acc
}

// ---- commands ----------------------------------------------------------------------

function cmdHelp(): void {
  out(`Mercado Pago Marketplace sandbox spike helper (card #73). Runbook: docs/mp-sandbox-spike.md

Usage: npx tsx scripts/mp-sandbox-spike.ts <command> [--flag=value]

Commands
  authorize-url --seller=A|B [--pkce] [--redirect=URL]
        Builds the OAuth authorization URL for a seller (pure: no network). Saves the state (and the PKCE
        verifier) in .mp-spike.local.json. Needs MP_APP_ID and a redirect URI.
  exchange --seller=A|B --code=CODE [--test-token=true|false] [--state=STATE]
        Exchanges the authorization code (valid 10 minutes, single use). Prints non-secret fields and masked
        tokens; stores the tokens in .mp-spike.local.json. --test-token defaults to false, like the API.
  account --seller=A|B
        Reads GET /users/me with the seller token and tells whether it looks like a test user.
  preference --seller=A|B --amount=N [--fee=N] [--title=TXT] [--notification-url=URL] [--external-reference=ID]
        Creates a Checkout Pro preference with the seller's token (and marketplace_fee when --fee is given).
        Prints init_point and sandbox_init_point. Open one with the BUYER test user.
  payment --id=MP_PAYMENT_ID --seller=A|B|app [--raw]
        GET /v1/payments/{id} with a seller token, or with the app's own client_credentials token (--seller=app).
        Prints amounts, fees, collector, refunds. Use another seller to see what a wrong token answers.
  refund --id=MP_PAYMENT_ID --seller=A|B [--amount=N] [--idempotency-key=KEY]
        POST /v1/payments/{id}/refunds with the seller token. No --amount = full refund, no body (like the
        API). Prints the answer, then the payment again. No idempotency key is sent unless given (like the API).
  balance --seller=A|B
        Tries GET /users/{id}/mercadopago_account/balance with the seller token (may be forbidden).
  webhook-sample
        Prints what to capture and verify in a webhook notification (no network).
  help
        This text.

Environment (read from this shell only; no .env file is loaded)
  MP_APP_ID, MP_APP_SECRET        Marketplace application credentials (TEST app)
  MP_SPIKE_REDIRECT_URI           Redirect URL registered in the app, used by authorize-url and exchange
                                  (falls back to MP_OAUTH_REDIRECT_URI)
  MP_SPIKE_CONFIRM_TEST=yes       Required by every command that calls Mercado Pago
  MP_SPIKE_TEST_USER_IDS          Optional, comma-separated ids you verified are test users in the MP panel
  MP_ACCESS_TOKEN                 Must NOT be set (the script refuses to run with it)
`)
}

function cmdAuthorizeUrl(flags: Args['flags']): void {
  const seller = reqSeller(flags)
  const appId = env('MP_APP_ID')
  if (!appId) fail('MP_APP_ID is not set.')
  if (env('NODE_ENV')?.toLowerCase() === 'production') fail('NODE_ENV=production is set. Refusing to run.', 2)
  const redirect = redirectUri(flags)
  const state = `spike-${seller}-${randomBytes(16).toString('hex')}`
  const params = new URLSearchParams({
    client_id: appId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: redirect,
  })
  let verifier: string | null = null
  if (flags.pkce === true) {
    verifier = randomBytes(48).toString('base64url')
    params.set('code_challenge', createHash('sha256').update(verifier, 'utf8').digest('base64url'))
    params.set('code_challenge_method', 'S256')
  }
  const store = loadStore()
  store.pending[seller] = { state, code_verifier: verifier, redirect_uri: redirect, created_at: new Date().toISOString() }
  saveStore(store)

  out(`Authorization URL for seller ${seller}${verifier ? ' (PKCE S256)' : ''}:`)
  out()
  out(`${AUTH_URL}?${params.toString()}`)
  out()
  out(`state saved in ${TOKEN_FILE}`)
  out('Open it in a browser logged in as the TEST seller (use a private window per seller), authorize, then copy')
  out('the `code` query parameter from the address bar you land on. The code is valid for 10 minutes.')
  out(`Then: npx tsx scripts/mp-sandbox-spike.ts exchange --seller=${seller} --code=<code>`)
}

async function cmdExchange(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const seller = reqSeller(flags)
  const code = reqFlag(flags, 'code')
  const appId = env('MP_APP_ID')
  const appSecret = env('MP_APP_SECRET')
  if (!appId || !appSecret) fail('MP_APP_ID and MP_APP_SECRET must be set.')
  const testToken = strFlag(flags, 'test-token') ?? 'false'
  if (testToken !== 'true' && testToken !== 'false') fail('--test-token must be true or false')

  const store = loadStore()
  const pending = store.pending[seller]
  const wantedState = strFlag(flags, 'state')
  if (wantedState && pending && wantedState !== pending.state) {
    fail('--state does not match the state saved by authorize-url for this seller. Possible mix-up of sellers.')
  }
  const redirect = pending?.redirect_uri ?? redirectUri(flags)

  const res = await http('POST', `${MP_API}/oauth/token`, {
    json: {
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
      test_token: testToken, // the doc's example sends a string; the API sends the boolean false
      ...(pending?.code_verifier ? { code_verifier: pending.code_verifier } : {}),
    },
  })
  if (res.status < 200 || res.status >= 300 || !res.body) {
    printHttpFailure('POST /oauth/token', res)
    out('Record this answer in the findings (exchange section): it may be the finding itself.')
    process.exit(1)
  }
  const b = res.body
  const accessToken = typeof b.access_token === 'string' ? b.access_token : ''
  if (!accessToken) fail('Token response had no access_token (unexpected shape). Fields present: ' + Object.keys(b).join(', '))

  const account: StoredAccount = {
    access_token: accessToken,
    refresh_token: typeof b.refresh_token === 'string' ? b.refresh_token : null,
    user_id: b.user_id !== undefined ? String(b.user_id) : null,
    public_key: typeof b.public_key === 'string' ? b.public_key : null,
    scope: typeof b.scope === 'string' ? b.scope : null,
    live_mode: typeof b.live_mode === 'boolean' ? b.live_mode : null,
    expires_in: typeof b.expires_in === 'number' ? b.expires_in : null,
    obtained_at: new Date().toISOString(),
    test_token_flag: testToken,
  }
  store.accounts[seller] = account
  delete store.pending[seller]
  saveStore(store)

  out(`Seller ${seller} linked. Response fields present: ${Object.keys(b).sort().join(', ')}`)
  out(`  user_id       : ${account.user_id ?? '(missing)'}`)
  out(`  scope         : ${account.scope ?? '(missing)'}`)
  out(`  live_mode     : ${account.live_mode === null ? '(missing)' : String(account.live_mode)}`)
  out(`  expires_in    : ${account.expires_in === null ? '(missing)' : `${account.expires_in}s (~${Math.round(account.expires_in / 86400)} days)`}`)
  out(`  token_type    : ${typeof b.token_type === 'string' ? b.token_type : '(missing)'}`)
  out(`  access_token  : ${mask(account.access_token)}`)
  out(`  refresh_token : ${mask(account.refresh_token)}`)
  out(`  public_key    : ${mask(account.public_key)}`)
  out(`  test_token sent: ${testToken}`)
  out(`Tokens written to ${TOKEN_FILE} (gitignored).`)
}

async function cmdAccount(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const seller = reqSeller(flags)
  const acc = accountFor(seller)
  const info = await readAccount(acc.access_token)
  if (!info) process.exit(1)
  printAccount(`Seller ${seller} account`, info, acc.live_mode)
}

async function cmdPreference(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const seller = reqSeller(flags)
  const amount = reqNumber(flags, 'amount')
  const feeRaw = strFlag(flags, 'fee')
  const fee = feeRaw === undefined ? undefined : Number(feeRaw)
  if (fee !== undefined && !Number.isFinite(fee)) fail(`--fee must be a number (got "${feeRaw}")`)
  const acc = await guardSellerAccount(seller)

  const reference = strFlag(flags, 'external-reference') ?? `spike-${seller}-${Date.now()}`
  const notificationUrl = strFlag(flags, 'notification-url')
  const body: Record<string, unknown> = {
    items: [{ id: reference, title: strFlag(flags, 'title') ?? `MP spike ${seller}`, quantity: 1, unit_price: amount, currency_id: 'ARS' }],
    external_reference: reference,
    back_urls: {
      success: 'https://example.com/mp-spike?payment=success',
      failure: 'https://example.com/mp-spike?payment=failure',
      pending: 'https://example.com/mp-spike?payment=pending',
    },
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    ...(fee !== undefined ? { marketplace_fee: fee } : {}),
  }
  out(`POST /checkout/preferences as seller ${seller}: amount=${amount} marketplace_fee=${fee === undefined ? '(omitted)' : fee}`)
  const res = await http('POST', `${MP_API}/checkout/preferences`, { token: acc.access_token, json: body })
  if (res.status < 200 || res.status >= 300 || !res.body) {
    printHttpFailure('Preference creation', res)
    out('Record this answer in the findings (fee limits section).')
    process.exit(1)
  }
  const b = res.body
  out(`  preference id       : ${String(b.id ?? '')}`)
  out(`  external_reference  : ${reference}`)
  out(`  collector_id        : ${String(b.collector_id ?? '(missing)')}   (seller user id: ${acc.user_id ?? 'unknown'})`)
  out(`  marketplace_fee     : ${b.marketplace_fee === undefined ? '(not echoed)' : String(b.marketplace_fee)}`)
  out(`  sponsor_id          : ${b.sponsor_id === undefined ? '(not echoed)' : String(b.sponsor_id)}`)
  out(`  client_id           : ${String(b.client_id ?? '(missing)')}   (should be the app id)`)
  out(`  site_id             : ${String(b.site_id ?? '(missing)')}`)
  out(`  init_point          : ${String(b.init_point ?? '')}`)
  out(`  sandbox_init_point  : ${String(b.sandbox_init_point ?? '')}`)
  out()
  out('Open the init_point (or sandbox_init_point if init_point asks for a real login) in a PRIVATE window logged')
  out('in as the BUYER test user, and pay with a Mercado Pago test card. Then take the payment id from the')
  out('result page / URL (collection_id or payment_id) and run: payment --id=<id> --seller=' + seller)
}

function pickPaymentFields(b: Record<string, unknown>): Record<string, unknown> {
  const feeKeys = Object.keys(b).filter((k) => /fee/i.test(k))
  const details = (b.transaction_details ?? {}) as Record<string, unknown>
  const payer = (b.payer ?? {}) as Record<string, unknown>
  const refunds = Array.isArray(b.refunds) ? (b.refunds as Array<Record<string, unknown>>) : []
  return {
    id: b.id,
    status: b.status,
    status_detail: b.status_detail,
    live_mode: b.live_mode,
    operation_type: b.operation_type,
    currency_id: b.currency_id,
    transaction_amount: b.transaction_amount,
    transaction_amount_refunded: b.transaction_amount_refunded,
    external_reference: b.external_reference,
    collector_id: b.collector_id,
    payer_id: payer.id,
    application_id: b.application_id,
    sponsor_id: b.sponsor_id,
    fee_fields_top_level: Object.fromEntries(feeKeys.map((k) => [k, b[k]])),
    fee_details: b.fee_details,
    net_received_amount: details.net_received_amount,
    total_paid_amount: details.total_paid_amount,
    money_release_date: b.money_release_date,
    money_release_status: b.money_release_status,
    refunds: refunds.map((r) => ({ id: r.id, amount: r.amount, status: r.status, source: r.source, date_created: r.date_created })),
    date_approved: b.date_approved,
  }
}

/** Token for a payment read: a linked seller, or the app's own client_credentials token (`app`). */
async function tokenForRead(who: string): Promise<{ token: string; label: string }> {
  if (who.toLowerCase() === 'app') {
    const appId = env('MP_APP_ID')
    const appSecret = env('MP_APP_SECRET')
    if (!appId || !appSecret) fail('MP_APP_ID and MP_APP_SECRET must be set for --seller=app.')
    const res = await http('POST', `${MP_API}/oauth/token`, {
      json: { client_id: appId, client_secret: appSecret, grant_type: 'client_credentials' },
    })
    const token = res.body && typeof res.body.access_token === 'string' ? res.body.access_token : ''
    if (res.status !== 200 || !token) {
      printHttpFailure('client_credentials token', res)
      process.exit(1)
    }
    return { token, label: `the app's own client_credentials token (${mask(token)})` }
  }
  const upper = who.toUpperCase()
  if (upper !== 'A' && upper !== 'B') fail('--seller must be A, B or app')
  return { token: accountFor(upper as Seller).access_token, label: `seller ${upper}'s token` }
}

async function printPayment(id: string, who: string, raw: boolean): Promise<boolean> {
  const { token, label } = await tokenForRead(who)
  out(`GET /v1/payments/${id} with ${label}`)
  const res = await http('GET', `${MP_API}/v1/payments/${encodeURIComponent(id)}`, { token })
  if (res.status !== 200 || !res.body) {
    printHttpFailure('Payment read', res)
    return false
  }
  printJson('payment (selected fields)', pickPaymentFields(res.body))
  if (raw) printJson('payment (raw, secret-looking keys redacted)', redact(res.body))
  return true
}

async function cmdPayment(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const id = reqFlag(flags, 'id')
  const who = reqFlag(flags, 'seller')
  if (!(await printPayment(id, who, flags.raw === true))) process.exit(1)
}

async function cmdRefund(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const id = reqFlag(flags, 'id')
  const seller = reqSeller(flags)
  const amountRaw = strFlag(flags, 'amount')
  const amount = amountRaw === undefined ? undefined : Number(amountRaw)
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) fail('--amount must be a positive number')
  const key = strFlag(flags, 'idempotency-key')
  const acc = await guardSellerAccount(seller)

  out(`POST /v1/payments/${id}/refunds as seller ${seller}: ${amount === undefined ? 'FULL (no body)' : `PARTIAL amount=${amount}`}${key ? ` X-Idempotency-Key=${key}` : ' (no idempotency key, like the API)'}`)
  const res = await http('POST', `${MP_API}/v1/payments/${encodeURIComponent(id)}/refunds`, {
    token: acc.access_token,
    ...(amount !== undefined ? { json: { amount } } : {}),
    ...(key ? { headers: { 'X-Idempotency-Key': key } } : {}),
  })
  out(`  HTTP ${res.status}`)
  if (res.status >= 200 && res.status < 300 && res.body) {
    const b = res.body
    printJson('  refund', {
      id: b.id,
      payment_id: b.payment_id,
      amount: b.amount,
      status: b.status,
      source: b.source,
      date_created: b.date_created,
      unique_sequence_number: b.unique_sequence_number,
    })
  } else {
    printJson('  error body (safe fields) - THIS is the answer for the no-balance / rejection question', errorSummary(res))
  }
  out()
  out('Payment after the refund attempt:')
  await printPayment(id, seller, false)
}

async function cmdBalance(flags: Args['flags']): Promise<void> {
  assertSafeEnvironment()
  const seller = reqSeller(flags)
  const acc = accountFor(seller)
  const userId = acc.user_id ?? (await readAccount(acc.access_token))?.id
  if (!userId) fail('Could not determine the seller user id.')
  const res = await http('GET', `${MP_API}/users/${userId}/mercadopago_account/balance`, { token: acc.access_token })
  if (res.status !== 200 || !res.body) {
    printHttpFailure('Balance read', res)
    out('The balance endpoint is not available to this token. Read the balance in the test account\'s Mercado Pago')
    out('web UI (log in as that test user, "Tu dinero" / activity) and record it by hand.')
    return
  }
  const b = res.body
  printJson('balance (selected fields)', {
    currency_id: b.currency_id,
    total_amount: b.total_amount,
    available_balance: b.available_balance,
    unavailable_balance: b.unavailable_balance,
  })
}

function cmdWebhookSample(): void {
  out(`What to capture and verify in a webhook notification (card #73, question 6)

How to get one: pass --notification-url=https://webhook.site/<your-id>?club_id=spike to \`preference\`, pay, and
read the request webhook.site recorded. (Notifications are not sent for payments made with test credentials in some
setups: if nothing arrives, use the "Webhooks > Simulate" tool of the app, then run the API on dev, see the runbook.)

Expected body (shape per the public docs; every field is to be CONFIRMED):
  { "id": <notification id>, "live_mode": <bool>, "type": "payment", "date_created": "...",
    "api_version": "v1", "action": "payment.created|payment.updated",
    "data": { "id": "<mp payment id>" }, "user_id": <seller id?>, "application_id": <app id?> }
Query string MP adds: ?data.id=<mp payment id>&type=payment

Record:
  1. Does the URL keep your own query (?club_id=spike) and add data.id / type with "&"?
  2. Which field identifies the seller: body.user_id? body.application_id? payment.collector_id?
  3. Headers: x-signature (ts=...,v1=...), x-request-id. Is data.id lowercase in the manifest?
  4. Signature: manifest = "id:<data.id lowercased>;request-id:<x-request-id>;ts:<ts>;" HMAC-SHA256 with the app's
     webhook secret (this is what verifyWebhookSignature does). Same secret for payments of both sellers?
  5. Which token reads the payment: run \`payment --id=<id> --seller=A\`, \`--seller=B\` and \`--seller=app\`.
     Which answer 200, which 403/404?
  6. Is a notification sent per refund (action payment.updated, status refunded / partially refunded)?
  7. Retries: does it come again if you answer non-2xx? (do not rely on it, record only)
`)
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2))
  if (flags.help === true || command === '--help' || command === '-h') return cmdHelp()
  switch (command) {
    case 'help':
      return cmdHelp()
    case 'authorize-url':
      return cmdAuthorizeUrl(flags)
    case 'exchange':
      return cmdExchange(flags)
    case 'account':
      return cmdAccount(flags)
    case 'preference':
      return cmdPreference(flags)
    case 'payment':
      return cmdPayment(flags)
    case 'refund':
      return cmdRefund(flags)
    case 'balance':
      return cmdBalance(flags)
    case 'webhook-sample':
      return cmdWebhookSample()
    default:
      fail(`Unknown command "${command}". Run with --help.`)
  }
}

main().catch((err: unknown) => {
  // Never print the error object: it could carry request details. Name and message only.
  const e = err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error'
  fail(e)
})
