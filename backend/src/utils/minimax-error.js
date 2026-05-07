/**
 * MiniMax API Error Codes
 * https://www.minimaxi.com/document/API%20Documentation
 */

export const MINIMAX_ERROR_CODES = {
  // Success
  0: { message: 'Success', userMessage: 'Operation completed successfully', severity: 'success' },

  // Rate limiting
  1002: { message: 'Rate limit exceeded', userMessage: 'Too many requests. Please wait a moment and try again.', severity: 'warning', retryable: true, retryAfter: 30 },

  // Authentication
  1004: { message: 'Authentication failed', userMessage: 'Authentication failed. Please check your API key.', severity: 'error', recoverable: false },
  2049: { message: 'Invalid API key', userMessage: 'Invalid API key. Please check your configuration.', severity: 'error', recoverable: false },

  // Account/Billing
  1008: { message: 'Insufficient balance', userMessage: 'Insufficient account balance. Please add credits to continue.', severity: 'warning', recoverable: false },

  // Content
  1026: { message: 'Content flagged as sensitive', userMessage: 'Content was flagged for review. Try different lyrics or wait a moment.', severity: 'warning', retryable: true },

  // Parameters
  2013: { message: 'Invalid parameters', userMessage: 'Invalid request parameters. Please check your input.', severity: 'error', recoverable: false },

  // Internal
  10001: { message: 'Internal server error', userMessage: 'Server error. Please try again later.', severity: 'error', retryable: true, retryAfter: 60 },
};

/**
 * Structured error for MiniMax API failures
 */
export class MinimaxError extends Error {
  constructor(statusCode, originalMessage) {
    const errorInfo = MINIMAX_ERROR_CODES[statusCode] || {
      message: originalMessage || 'Unknown error',
      userMessage: originalMessage || 'An unexpected error occurred',
      severity: 'error',
      retryable: true,
    };

    super(errorInfo.userMessage);
    this.name = 'MinimaxError';
    this.statusCode = statusCode;
    this.originalMessage = originalMessage;
    this.severity = errorInfo.severity;
    this.retryable = errorInfo.retryable;
    this.retryAfter = errorInfo.retryAfter;
    this.recoverable = errorInfo.recoverable;
  }

  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      originalMessage: this.originalMessage,
      severity: this.severity,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      recoverable: this.recoverable,
    };
  }
}

/**
 * Check if error is a MiniMax API error
 */
export function isMinimaxError(error) {
  return error instanceof MinimaxError || (error.statusCode !== undefined && error.name === 'MinimaxError');
}

/**
 * Get error info for frontend display
 */
export function getErrorInfo(error) {
  if (error instanceof MinimaxError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      severity: error.severity,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
      recoverable: error.recoverable,
    };
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return {
      statusCode: 'NETWORK',
      message: 'Unable to connect to server. Please check your connection.',
      severity: 'error',
      retryable: true,
    };
  }

  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return {
      statusCode: 'TIMEOUT',
      message: 'Request timed out. Please try again.',
      severity: 'warning',
      retryable: true,
    };
  }

  // Generic errors
  return {
    statusCode: 'UNKNOWN',
    message: error.message || 'An unexpected error occurred',
    severity: 'error',
    retryable: true,
  };
}
