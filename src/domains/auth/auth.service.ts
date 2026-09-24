import { AuthRepository } from './auth.repository'
import { AppError } from '../../types/errors'
import type { RegisterDto, LoginDto } from './auth.validator'

export class AuthService {
  static async register(dto: RegisterDto) {
    const existing = await AuthRepository.findByEmail(dto.email)
    if (existing) {
      throw new AppError('CONFLICT', 'Ya existe una cuenta con ese email', 409)
    }
    return AuthRepository.createUser(dto)
  }

  static async login(dto: LoginDto) {
    const result = await AuthRepository.signIn(dto.email, dto.password)
    if (!result) {
      throw new AppError('UNAUTHORIZED', 'Email o contraseña incorrectos', 401)
    }
    return result
  }

  static async logout(userId: string) {
    return AuthRepository.signOut(userId)
  }

  static async refresh(refreshToken: string) {
    const result = await AuthRepository.refreshSession(refreshToken)
    if (!result) {
      throw new AppError('UNAUTHORIZED', 'Sesión expirada', 401)
    }
    return result
  }

  static async getProfile(userId: string) {
    const profile = await AuthRepository.getProfile(userId)
    if (!profile) {
      throw new AppError('NOT_FOUND', 'Usuario no encontrado', 404)
    }
    return profile
  }
}
