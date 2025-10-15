import User from '../models/User.js';
import jwt from 'jsonwebtoken';

class AuthService {
  // Registro de usuario
  async register(userData) {
    const { name, email, password } = userData;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Crear usuario
    const user = await User.create({ name, email, password });

    // Generar token
    const token = this.generateToken(user);

    return {
      user: user.toJSON(),
      token
    };
  }

  // Login de usuario
  async login(credentials) {
    const { email, password } = credentials;

    // Buscar usuario
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    // Verificar contraseña
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    // Generar token
    const token = this.generateToken(user);

    return {
      user: user.toJSON(),
      token
    };
  }

  // Obtener perfil de usuario
  async getProfile(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      user: user.toJSON()
    };
  }

  // Generar token JWT
  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
  }

  // Verificar token
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  }
}

export default new AuthService();
