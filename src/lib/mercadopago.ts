import { MercadoPagoConfig, Preference } from 'mercadopago'
import type { PreferenceRequest } from 'mercadopago/dist/clients/preference/commonTypes'

const MP_API_BASE = 'https://api.mercadopago.com'

/** The platform's own access token (read at call time, as the webhook and refunds always did). */
export function getPlatformAccessToken(): string {
  return process.env.MP_ACCESS_TOKEN ?? ''
}

// Kept for compatibility: the singleton built with the platform token.
export const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? '',
  options: { timeout: 5000 },
})

export const preference = new Preference(mp)

// ---- Charging client (card #75) -------------------------------------------------
// One small client per access token (the platform's or a club's), with its HTTP
// calls injectable so the charging logic can be checked without Mercado Pago.
// NOT verified against the Mercado Pago sandbox (card #73): see docs/mercadopago.md.

export type MpPreferenceBody = PreferenceRequest

export interface MpPreferenceResult {
  id: string | undefined
  init_point: string | undefined
  sandbox_init_point: string | undefined
}

/** The fields of a Mercado Pago payment that the webhook needs. */
export interface MpPaymentDetails {
  status: string
  external_reference: string | null
  transaction_amount: number
  /** Id of the seller's Mercado Pago user that collected the payment (`collector_id`). */
  collector_id: string | null
  /** Sum of the `application_fee` entries of `fee_details` (the marketplace fee), null if not reported. */
  application_fee: number | null
}

export interface MpChargeClient {
  createPreference(body: MpPreferenceBody): Promise<MpPreferenceResult>
  /** null when Mercado Pago does not answer 2xx (the caller logs the status). */
  getPayment(mpPaymentId: string): Promise<{ details: MpPaymentDetails | null; httpStatus: number }>
  /** Full refund when `amount` is omitted, partial when given. true when Mercado Pago accepted it. */
  refund(mpPaymentId: string, amount?: number): Promise<{ ok: boolean; httpStatus: number }>
}

export interface MpClientDeps {
  fetchFn?: typeof fetch
  createPreference?: (accessToken: string, body: MpPreferenceBody) => Promise<MpPreferenceResult>
}

async function sdkCreatePreference(accessToken: string, body: MpPreferenceBody): Promise<MpPreferenceResult> {
  const config = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } })
  const pref = await new Preference(config).create({ body })
  return { id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point }
}

export function parsePaymentDetails(raw: Record<string, unknown>): MpPaymentDetails {
  const feeDetails = Array.isArray(raw.fee_details) ? (raw.fee_details as Array<Record<string, unknown>>) : null
  let applicationFee: number | null = null
  if (feeDetails) {
    const entries = feeDetails.filter((f) => f && f.type === 'application_fee')
    if (entries.length > 0) {
      const sum = entries.reduce((acc, f) => acc + Number(f.amount ?? 0), 0)
      applicationFee = Number.isFinite(sum) ? Math.round(sum * 100) / 100 : null
    }
  }
  const collector = raw.collector_id
  return {
    status: String(raw.status ?? ''),
    external_reference: typeof raw.external_reference === 'string' && raw.external_reference ? raw.external_reference : null,
    transaction_amount: Number(raw.transaction_amount),
    collector_id: collector === undefined || collector === null || collector === '' ? null : String(collector),
    application_fee: applicationFee,
  }
}

export function createMpChargeClient(accessToken: string, deps: MpClientDeps = {}): MpChargeClient {
  const fetchFn = deps.fetchFn ?? fetch
  const createPreferenceFn = deps.createPreference ?? sdkCreatePreference

  return {
    createPreference: (body) => createPreferenceFn(accessToken, body),

    async getPayment(mpPaymentId) {
      const res = await fetchFn(`${MP_API_BASE}/v1/payments/${encodeURIComponent(mpPaymentId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return { details: null, httpStatus: res.status }
      return { details: parsePaymentDetails((await res.json()) as Record<string, unknown>), httpStatus: res.status }
    },

    async refund(mpPaymentId, amount) {
      const partial = amount !== undefined
      const res = await fetchFn(`${MP_API_BASE}/v1/payments/${encodeURIComponent(mpPaymentId)}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        // A full refund sends no body, exactly as before this card.
        ...(partial ? { body: JSON.stringify({ amount }) } : {}),
      })
      return { ok: res.ok, httpStatus: res.status }
    },
  }
}
