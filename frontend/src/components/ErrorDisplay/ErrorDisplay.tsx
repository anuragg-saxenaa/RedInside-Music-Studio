import React from 'react';
import { getErrorDisplay, isRetryable, parseApiError } from '../../utils/errors';

interface ErrorDisplayProps {
  error: unknown;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onDismiss, onRetry }: ErrorDisplayProps) {
  const display = getErrorDisplay(error);
  const canRetry = isRetryable(error);

  const severityStyles = {
    error: {
      bg: 'rgba(230, 57, 70, 0.1)',
      border: 'rgba(230, 57, 70, 0.3)',
      icon: '#E63946',
    },
    warning: {
      bg: 'rgba(255, 184, 0, 0.1)',
      border: 'rgba(255, 184, 0, 0.3)',
      icon: '#FFB800',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.3)',
      icon: '#3B82F6',
    },
  };

  const style = severityStyles[display.severity] || severityStyles.error;

  return (
    <div
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {display.severity === 'error' && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: style.icon }}>
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
          </svg>
        )}
        {display.severity === 'warning' && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: style.icon }}>
            <path d="M10 2L18 16H2L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="14" r="0.75" fill="currentColor" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <h4 style={{
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '4px',
        }}>
          {display.title}
        </h4>
        <p style={{
          color: '#A0A0A0',
          fontSize: '13px',
          lineHeight: 1.5,
          marginBottom: display.action ? '8px' : 0,
        }}>
          {display.description}
        </p>
        {display.action && (
          <p style={{
            color: '#666666',
            fontSize: '12px',
          }}>
            {display.action}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {onRetry && canRetry && (
          <button
            onClick={onRetry}
            style={{
              backgroundColor: '#2A2A2A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7C2 4.24 4.24 2 7 2C9.76 2 12 4.24 12 7C12 9.76 9.76 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 4V7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              backgroundColor: 'transparent',
              color: '#666666',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorDisplay;
