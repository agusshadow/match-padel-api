import * as userService from '../services/userService.js';

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const filters = {
      role: req.query.role,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    const users = await userService.getAllUsers(filters);

    res.json({
      success: true,
      message: 'Usuarios obtenidos exitosamente',
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener un usuario por ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const user = await userService.getUserById(parseInt(id));

    res.json({
      success: true,
      message: 'Usuario obtenido exitosamente',
      data: user
    });
  } catch (error) {
    const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Obtener perfil del usuario autenticado
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userService.getUserProfile(userId);

    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      data: user
    });
  } catch (error) {
    const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Crear un nuevo usuario
const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const userData = { name, email, password, role };
    const newUser = await userService.createUser(userData);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: newUser
    });
  } catch (error) {
    const statusCode = error.message.includes('ya está registrado') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Actualizar un usuario
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    // Validar que no se intente actualizar la contraseña desde aquí
    if (updateData.password) {
      return res.status(400).json({
        success: false,
        message: 'Para cambiar la contraseña use el endpoint específico'
      });
    }

    const updatedUser = await userService.updateUser(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser
    });
  } catch (error) {
    const statusCode = error.message === 'Usuario no encontrado' ? 404 : 
                      error.message.includes('ya está registrado') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Eliminar un usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const result = await userService.deleteUser(parseInt(id));

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    const result = await userService.changePassword(parseInt(id), currentPassword, newPassword);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message === 'Usuario no encontrado' ? 404 : 
                      error.message.includes('incorrecta') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// Cambiar contraseña del usuario autenticado
const changeMyPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    const result = await userService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const statusCode = error.message.includes('incorrecta') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getAllUsers,
  getUserById,
  getUserProfile,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  changeMyPassword
};
