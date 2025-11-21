import authService from '../services/authService.js';
import { successObject, error } from '../utils/responseHelper.js';

const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return successObject(res, result, 201, 'Usuario registrado');
  } catch (err) {
    return error(res, err.message, 400, 'REGISTRATION_ERROR');
  }
};

const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return successObject(res, result, 200, 'Login exitoso');
  } catch (err) {
    return error(res, err.message, 401, 'LOGIN_ERROR');
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await authService.getProfile(req.user.id);
    return successObject(res, result);
  } catch (err) {
    return error(res, err.message, 404, 'NOT_FOUND');
  }
};

export {
  register,
  login,
  getProfile
};