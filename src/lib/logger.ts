const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  info: (obj: unknown, msg?: string) => console.log(msg ?? obj, isDev ? obj : ''),
  debug: (obj: unknown, msg?: string) => { if (isDev) console.log(msg ?? obj, obj) },
  warn: (obj: unknown, msg?: string) => console.warn(msg ?? obj, obj),
  error: (obj: unknown, msg?: string) => console.error(msg ?? obj, obj),
}
