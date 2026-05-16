import logger from '../../utils/logger.js';

// MiniMax API codes → HTTP status codes
const MINIMAX_TO_HTTP = {
  1002: 429, // rate limit → Too Many Requests
  1004: 401, // auth failed → Unauthorized
  1008: 402, // insufficient balance → Payment Required
  1026: 422, // content flagged → Unprocessable Entity
  2013: 400, // invalid params → Bad Request
  2049: 401, // invalid key → Unauthorized
};

export const errorMiddleware = (err, req, res, next) => {
  // Log the error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Determine HTTP status code
  // MinimaxError.statusCode is a MiniMax-specific code (1002, 1004, etc.),
  // not a valid HTTP code — must remap to avoid Node.js RangeError
  let httpStatus;
  if (err.name === 'MinimaxError') {
    httpStatus = MINIMAX_TO_HTTP[err.statusCode] || 502;
  } else {
    const code = err.statusCode || err.status;
    httpStatus = (code >= 100 && code <= 599) ? code : 500;
  }

  // Build error response - preserve MinimaxError info for frontend
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Include MinimaxError-specific fields if present
  if (err.name === 'MinimaxError') {
    errorResponse.statusCode = err.statusCode;
    errorResponse.severity = err.severity;
    errorResponse.retryable = err.retryable;
    errorResponse.retryAfter = err.retryAfter;
    errorResponse.recoverable = err.recoverable;
  }

  // Send error response
  res.status(httpStatus).json(errorResponse);
};

export default errorMiddleware;