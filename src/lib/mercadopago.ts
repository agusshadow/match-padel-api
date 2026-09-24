import { MercadoPagoConfig, Preference } from 'mercadopago'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? ''

export const mp = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
  options: { timeout: 5000 },
})

export const preference = new Preference(mp)
