import { supabase } from '../../lib/supabase'
import { preference } from '../../lib/mercadopago'
import { NotFoundError, ForbiddenError, AppError } from '../../types/errors'

const APP_URL = process.env.APP_URL ?? 'https://match-padel-web.vercel.app'
const API_URL = process.env.API_URL ?? 'https://match-padel-api.railway.app'

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

export async function handleWebhook(body: Record<string, unknown>) {
  // Only handle payment notifications
  if (body.type !== 'payment') return { handled: false }

  const data = body.data as Record<string, unknown> | undefined
  const paymentId = data?.id ? String(data.id) : ''
  if (!paymentId) return { handled: false }

  // Get payment details from MP
  const mpResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  if (!mpResponse.ok) return { handled: false }

  const mpPayment = (await mpResponse.json()) as Record<string, unknown>
  const reservationId = mpPayment.external_reference as string
  const mpStatus = mpPayment.status as string

  if (!reservationId) return { handled: false }

  // Update payment record
  const paymentStatus =
    mpStatus === 'approved' ? 'approved' :
    mpStatus === 'rejected' ? 'rejected' :
    mpStatus === 'cancelled' ? 'cancelled' :
    'pending'

  await supabase
    .from('payments')
    .update({ status: paymentStatus, mp_payment_id: paymentId })
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
