import User from '../models/User.js';

// Obtener todos los usuarios
const getAllUsers = async () => {
  return await User.findAll();
};

// Obtener un usuario por ID
const getUserById = async (id) => {
  return await User.findByPk(id);
};

// Crear un nuevo usuario
const createUser = async (userData) => {
  return await User.create(userData);
};

// Actualizar un usuario
const updateUser = async (id, updateData) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('Usuario no encontrado');
  return await user.update(updateData);
};

// Eliminar un usuario
const deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('Usuario no encontrado');
  return await user.destroy();
};

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};