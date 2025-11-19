import * as userService from '../services/userService.js';
import { successList, successObject, error } from '../utils/responseHelper.js';

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return successList(res, users);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Obtener un usuario por ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    return successObject(res, user);
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Crear un nuevo usuario
const createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    return successObject(res, user, 201, 'Usuario creado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Actualizar un usuario
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userService.updateUser(id, req.body);
    return successObject(res, user, 200, 'Usuario actualizado exitosamente');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

// Eliminar un usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id);
    return successObject(res, null, 200, 'Usuario eliminado');
  } catch (err) {
    return error(res, err.message, 500, 'SERVER_ERROR');
  }
};

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};