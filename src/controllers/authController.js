import authService from '../services/authService.js';

// Registro
const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);

    res.json({
      success: true,
      message: 'Login exitoso',
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

// Perfil del usuario
const getProfile = async (req, res) => {
  try {
    const result = await authService.getProfile(req.user.id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

export {
  register,
  login,
  getProfile
};