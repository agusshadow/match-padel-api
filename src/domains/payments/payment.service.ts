import crypto from 'crypto'
import { supabase } from '../../lib/supabase'
import { preference } from '../../lib/mercadopago'
import { logger } from '../../lib/logger'
import { NotFoundError, ForbiddenError, AppError } from '../../types/errors'

const APP_URL = process.env.APP_URL ?? 'https://match-padel-web.vercel.app'
const API_URL = process.env.API_URL ?? 'https://match-padel-api.railway.app'
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET ?? ''

export async function createPaymentPreference(
  reservationId: string,
  userId: string,
) {
  // Fetch reservation with court + club details
  const { data: reservation, error } = await supabase
    .from('court_reservations')
    .select(`
      id, user_id, total_price, status,
      court:courts(name, club:clubs(name))
    `)
    .eq('id', reservationId)
    .single()

  if (error || !reservation) throw new NotFoundError('Reservation')
  if (reservation.user_id !== userId) throw new ForbiddenError('Not your reservation')
  if (reservation.status !== 'pending') {
    throw new AppError('Reservation is not in pending status', 400, 'INVALID_STATUS')
  }

  const court = reservation.court as unknown as Record<string, unknown> | null
  const courtName = (court?.name as string) ?? 'Cancha'
  const clubName = ((court?.club as Record<string, unknown>)?.name as string) ?? 'Club'

  // Create MercadoPago preference
  const pref = await preference.create({
    body: {
      items: [
        {
          id: reservationId,
          title: `Reserva – ${courtName} en ${clubName}`,
          quantity: 1,
          unit_price: Number(reservation.total_price),
          currency_id: 'ARS',
        },
      ],
      external_reference: reservationId,
      back_urls: {
        success: `${APP_URL}/reservations/${reservationId}?payment=success`,
        failure: `${APP_URL}/reservations/${reservationId}?payment=failure`,
        pending: `${APP_URL}/reservations/${reservationId}?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${API_URL}/api/v1/payments/webhook`,
    },
  })

  // Create pending payment record
  await supabase.from('payments').insert({
    reservation_id: reservationId,
    user_id: userId,
    amount: Number(reservation.total_price),
    currency: 'ARS',
    status: 'pending',
    metadata: { preference_id: pref.id },
  })

  return {
    preference_id: pref.id,
    init_point: pref.init_point,
    sandbox_init_point: pref.sandbox_init_point,
  }
}

export class WebhookSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature') {
    super(message, 401, 'INVALID_SIGNATURE')
  }
}

/**
 * Verifies the `x-signature` header per MercadoPago's HMAC-SHA256 scheme.
 * Manifest format: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined,
): boolean {
  if (!MP_WEBHOOK_SECRET) {
    // No secret configured yet (e.g. webhook not set up in the MP panel) — fail closed.
    logger.error({}, 'MP_WEBHOOK_SECRET is not configured; rejecting webhook')
    return false
  }
  if (!xSignature || !dataId) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    }),
  )
  const ts = parts.ts
  const hash = parts.v1
  if (!ts || !hash) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ''};ts:${ts};`
  const expectedHash = crypto
    .createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex')

  if (expectedHash.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash))
}

export async function handleWebhook(
  body: Record<string, unknown>,
  dataIdFromQuery: string | undefined,
) {
  // Only handle payment notifications
  if (body.type !== 'payment') return { handled: false }

  const data = body.data as Record<string, unknown> | undefined
  const paymentId = data?.id ? String(data.id) : dataIdFromQuery ? String(dataIdFromQuery) : ''
  if (!paymentId) return { handled: false }

  // Notification-level id, used for idempotency (distinct from the payment id above)
  const eventId = body.id !== undefined ? String(body.id) : paymentId

  // Get payment details from MP
  const mpResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  if (!mpResponse.ok) {
    logger.error(
      { paymentId, status: mpResponse.status },
      'Failed to fetch payment details from MercadoPago',
    )
    return { handled: false }
  }

  const mpPayment = (await mpResponse.json()) as Record<string, unknown>
  const reservationId = mpPayment.external_reference as string
  const mpStatus = mpPayment.status as string
  const mpAmount = Number(mpPayment.transaction_amount)

  if (!reservationId) return { handled: false }

  // Idempotency: skip if this notification was already processed for this reservation.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, mp_event_id, reservation_id, amount')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (!existingPayment) {
    logger.error({ reservationId, paymentId }, 'Webhook received for unknown reservation')
    return { handled: false }
  }

  if (existingPayment.mp_event_id === eventId) {
    return { handled: true, status: mpStatus, deduped: true }
  }

  // Amount check: the paid amount must match what the reservation actually costs.
  const expectedAmount = Number(existingPayment.amount)
  if (Number.isFinite(expectedAmount) && Math.abs(mpAmount - expectedAmount) > 0.01) {
    logger.error(
      { reservationId, paymentId, mpAmount, expectedAmount },
      'MercadoPago webhook amount mismatch — refusing to confirm reservation',
    )
    await supabase
      .from('payments')
      .update({ mp_payment_id: paymentId, mp_event_id: eventId, metadata: { amount_mismatch: true, mpAmount, expectedAmount } })
      .eq('reservation_id', reservationId)
    return { handled: false, reason: 'amount_mismatch' }
  }

  const paymentStatus =
    mpStatus === 'approved' ? 'approved' :
    mpStatus === 'rejected' ? 'rejected' :
    mpStatus === 'cancelled' ? 'cancelled' :
    'pending'

  await supabase
    .from('payments')
    .update({ status: paymentStatus, mp_payment_id: paymentId, mp_event_id: eventId })
    .eq('reservation_id', reservationId)
    .eq('status', 'pending')

  // Update reservation status if payment approved or rejected/cancelled
  if (mpStatus === 'approved') {
    await supabase
      .from('court_reservations')
      .update({ status: 'confirmed' })
      .eq('id', reservationId)
      .eq('status', 'pending')
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    await supabase
      .from('court_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .eq('status', 'pending')
  }

  return { handled: true, status: mpStatus }
}
