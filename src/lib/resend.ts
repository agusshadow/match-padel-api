import { Resend } from 'resend'

let client: Resend | null = null
let clientKey: string | null = null

/**
 * Resend HTTP client, created lazily so the API boots (and mail runs in "log"
 * mode) without `RESEND_API_KEY`. Returns null when there is no key.
 */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  if (!client || clientKey !== key) {
    client = new Resend(key)
    clientKey = key
  }
  return client
}
