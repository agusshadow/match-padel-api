import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Obtener todos los usuarios
const getAllUsers = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Filtros opcionales
    if (filters.role) {
      whereClause.role = filters.role;
    }
    
    if (filters.isActive !== undefined) {
      whereClause.isActive = filters.isActive;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] }, // Excluir password por seguridad
      order: [['name', 'ASC']]
    });

    return users;
  } catch (error) {
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }
};

// Obtener un usuario por ID
const getUserById = async (id) => {
  try {
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] } // Excluir password por seguridad
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  } catch (error) {
    throw new Error(`Error al obtener usuario: ${error.message}`);
  }
};

// Obtener un usuario por email
const getUserByEmail = async (email) => {
  try {
    const user = await User.findOne({
      where: { email },
      attributes: { exclude: ['password'] }
    });

    return user;
  } catch (error) {
    throw new Error(`Error al obtener usuario por email: ${error.message}`);
  }
};

// Crear un nuevo usuario
const createUser = async (userData) => {
  try {
    // Verificar si el email ya existe
    const existingUser = await User.findOne({ where: { email: userData.email } });
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Encriptar password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = await User.create({
      ...userData,
      password: hashedPassword
    });

    // Retornar usuario sin password
    const { password, ...userWithoutPassword } = newUser.toJSON();
    return userWithoutPassword;
  } catch (error) {
    throw new Error(`Error al crear usuario: ${error.message}`);
  }
};

// Actualizar un usuario
const updateUser = async (id, userData) => {
  try {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Si se está actualizando el email, verificar que no exista
    if (userData.email && userData.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: userData.email } });
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }
    }

    // Si se está actualizando la password, encriptarla
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    await user.update(userData);

    // Retornar usuario actualizado sin password
    const { password, ...updatedUser } = user.toJSON();
    return updatedUser;
  } catch (error) {
    throw new Error(`Error al actualizar usuario: ${error.message}`);
  }
};

// Eliminar un usuario (soft delete)
const deleteUser = async (id) => {
  try {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.destroy();
    return { message: 'Usuario eliminado correctamente' };
  } catch (error) {
    throw new Error(`Error al eliminar usuario: ${error.message}`);
  }
};

// Cambiar password de usuario
const changePassword = async (id, currentPassword, newPassword) => {
  try {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar password actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('La contraseña actual es incorrecta');
    }

    // Encriptar nueva password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedNewPassword });

    return { message: 'Contraseña actualizada correctamente' };
  } catch (error) {
    throw new Error(`Error al cambiar contraseña: ${error.message}`);
  }
};

// Obtener perfil del usuario (con información adicional)
const getUserProfile = async (id) => {
  try {
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  } catch (error) {
    throw new Error(`Error al obtener perfil: ${error.message}`);
  }
};

export {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  getUserProfile
};
