import { supabase } from '../../lib/supabase'
import type { RegisterDto } from './auth.validator'

export class AuthRepository {
  static async findByEmail(email: string) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    return data
  }

  static async createUser(dto: RegisterDto) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        first_name: dto.first_name,
        last_name: dto.last_name,
        username: dto.username,
        skill_level: dto.skill_level,
        preferred_hand: dto.preferred_hand,
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
