/**
 * HELPER PARA RESPUESTAS ESTANDARIZADAS DE API
 * 
 * Formato estándar:
 * 
 * Éxito:
 * {
 *   success: true,
 *   data: T,  // Array o objeto único
 *   message?: string  // Opcional, solo para acciones (POST/PUT/PATCH/DELETE)
 * }
 * 
 * Error:
 * {
 *   success: false,
 *   error: {
 *     message: string,
 *     code?: string,
 *     details?: any
 *   }
 * }
 */

/**
 * Respuesta exitosa con lista
 * @param {Object} res - Objeto response de Express
 * @param {Array} data - Array de datos
 * @param {number} statusCode - Código HTTP (default: 200)
 * @param {string|null} message - Mensaje opcional (solo para acciones)
 */
export const successList = (res, data, statusCode = 200, message = null) => {
  const response = {
    success: true,
    data: Array.isArray(data) ? data : []
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

/**
 * Respuesta exitosa con objeto único
 * @param {Object} res - Objeto response de Express
 * @param {Object} data - Objeto de datos
 * @param {number} statusCode - Código HTTP (default: 200)
 * @param {string|null} message - Mensaje opcional (solo para acciones)
 */
export const successObject = (res, data, statusCode = 200, message = null) => {
  const response = {
    success: true,
    data: data || {}
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

/**
 * Respuesta de error
 * @param {Object} res - Objeto response de Express
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código HTTP (default: 500)
 * @param {string|null} code - Código de error opcional (ej: 'NOT_FOUND', 'VALIDATION_ERROR')
 * @param {any} details - Detalles adicionales del error (opcional)
 */
export const error = (res, message, statusCode = 500, code = null, details = null) => {
  const errorResponse = {
    success: false,
    error: {
      message
    }
  };

  if (code) {
    errorResponse.error.code = code;
  }

  if (details !== null && details !== undefined) {
    errorResponse.error.details = details;
  }

  return res.status(statusCode).json(errorResponse);
};

