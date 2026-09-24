import { supabase } from '../../lib/supabase'
import type { RegisterDto } from './auth.validator'

export class AuthRepository {
  static async findByEmail(email: string) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', (await supabase.auth.admin.getUserByEmail(email))?.data?.user?.id ?? '')
      .maybeSingle()
    return data
  }

  static async createUser(dto: RegisterDto) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        full_name: dto.full_name,
        username: dto.username,
      },
    })
    if (error) throw error
    return data
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return null
    return data
  }

  static async signOut(_userId: string) {
    // Con service_role no hay sesión que cerrar server-side; el cliente invalida el token
    return true
  }

  static async refreshSession(refreshToken: string) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (error) return null
    return data
  }

  static async getProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    return data
  }
}
