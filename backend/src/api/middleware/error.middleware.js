import logger from '../../utils/logger.js';

export const errorMiddleware = (err, req, res, next) => {
  // Log the error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response - preserve MinimaxError info for frontend
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Include MinimaxError-specific fields if present
  if (err.name === 'MinimaxError' || err.statusCode !== undefined) {
    errorResponse.statusCode = err.statusCode;
    errorResponse.severity = err.severity;
    errorResponse.retryable = err.retryable;
    errorResponse.retryAfter = err.retryAfter;
    errorResponse.recoverable = err.recoverable;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorMiddleware;