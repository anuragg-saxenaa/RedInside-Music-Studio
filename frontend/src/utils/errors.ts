/**
 * Frontend error handling for MiniMax API errors
 */

export interface ApiError {
  statusCode?: number | string;
  error: string;
  severity?: 'error' | 'warning' | 'success';
  retryable?: boolean;
  retryAfter?: number;
  recoverable?: boolean;
}

/**
 * User-friendly error messages for MiniMax error codes
 */
const ERROR_MESSAGES: Record<number | string, { title: string; description: string; action?: string }> = {
  1002: {
    title: 'Rate Limit Exceeded',
    description: 'Too many requests right now. Please wait a moment before trying again.',
    action: 'Try again in 30 seconds',
  },
  1004: {
    title: 'Authentication Failed',
    description: 'Unable to authenticate with the AI service. Your API key may be invalid.',
    action: 'Check your API key configuration',
  },
  1008: {
    title: 'Insufficient Balance',
    description: 'Your account has insufficient credits to complete this request.',
    action: 'Add credits to your MiniMax account',
  },
  1026: {
    title: 'Content Flagged',
    description: 'Your content was flagged for potential policy violation. Try different lyrics or wait.',
    action: 'Try different lyrics or style',
  },
  2013: {
    title: 'Invalid Parameters',
    description: 'The request contained invalid parameters. Please check your input.',
    action: 'Review and correct your input',
  },
  2049: {
    title: 'Invalid API Key',
    description: 'The API key appears to be invalid or expired.',
    action: 'Update your API key in configuration',
  },
  NETWORK: {
    title: 'Connection Error',
    description: 'Unable to connect to the server. Please check your internet connection.',
    action: 'Check your connection and try again',
  },
  TIMEOUT: {
    title: 'Request Timeout',
    description: 'The request took too long and was cancelled.',
    action: 'Try again',
  },
  UNKNOWN: {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again.',
    action: 'Try again',
  },
};

/**
 * Parse API error into structured format
 */
export function parseApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Already in our format
    if ('error' in err) {
      return {
        statusCode: err.statusCode as number | string | undefined,
        error: err.error as string,
        severity: err.severity as 'error' | 'warning' | 'success' | undefined,
        retryable: err.retryable as boolean | undefined,
        retryAfter: err.retryAfter as number | undefined,
        recoverable: err.recoverable as boolean | undefined,
      };
    }

    // Fetch error
    if ('message' in err) {
      return {
        error: err.message as string,
        retryable: true,
      };
    }
  }

  // Fallback
  return {
    error: 'An unexpected error occurred',
    retryable: true,
  };
}

/**
 * Get error display info
 */
export function getErrorDisplay(error: unknown): { title: string; description: string; action?: string; severity: 'error' | 'warning' | 'info' } {
  const parsed = parseApiError(error);
  const statusCode = parsed.statusCode;

  // Look up known error
  if (statusCode !== undefined) {
    const known = ERROR_MESSAGES[statusCode];
    if (known) {
      return {
        ...known,
        severity: parsed.severity || 'error',
      };
    }
  }

  // Fallback based on error message patterns
  const errorText = parsed.error.toLowerCase();

  if (errorText.includes('rate limit')) {
    return { ...ERROR_MESSAGES[1002], severity: 'warning' };
  }
  if (errorText.includes('authentication') || errorText.includes('auth')) {
    return { ...ERROR_MESSAGES[1004], severity: 'error' };
  }
  if (errorText.includes('balance') || errorText.includes('credit')) {
    return { ...ERROR_MESSAGES[1008], severity: 'warning' };
  }
  if (errorText.includes('sensitive') || errorText.includes('flagged') || errorText.includes('content')) {
    return { ...ERROR_MESSAGES[1026], severity: 'warning' };
  }
  if (errorText.includes('timeout')) {
    return { ...ERROR_MESSAGES.TIMEOUT, severity: 'warning' };
  }
  if (errorText.includes('network') || errorText.includes('connection')) {
    return { ...ERROR_MESSAGES.NETWORK, severity: 'error' };
  }

  return {
    ...ERROR_MESSAGES.UNKNOWN,
    description: parsed.error,
    severity: parsed.severity || 'error',
  };
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.retryable ?? true;
}

/**
 * Check if error is recoverable (user can fix it)
 */
export function isRecoverable(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.recoverable ?? true;
}

/**
 * Get retry delay in ms (0 if not retryable)
 */
export function getRetryDelay(error: unknown): number {
  const parsed = parseApiError(error);
  if (!parsed.retryable) return 0;
  return (parsed.retryAfter ?? 5) * 1000;
}
