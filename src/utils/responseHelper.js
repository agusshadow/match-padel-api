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

