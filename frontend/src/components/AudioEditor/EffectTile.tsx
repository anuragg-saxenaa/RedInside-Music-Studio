import React from 'react';

export interface EffectTileProps {
  label: string;
  color: string;
  enabled: boolean;
  value: string;
  onToggle: () => void;
  children?: React.ReactNode;
}

export default function EffectTile({ label, color, enabled, value, onToggle, children }: EffectTileProps) {
  return (
    <div
      style={{
        background: enabled ? `${color}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${enabled ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 0.15s, border-color 0.15s',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 9,
          letterSpacing: '0.12em',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <button
          onClick={onToggle}
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            border: 'none',
            background: enabled ? color : 'rgba(255,255,255,0.15)',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
            transition: 'background 0.15s',
            flexShrink: 0,
            boxShadow: enabled ? `0 0 6px ${color}80` : 'none',
          }}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: enabled ? 14 : 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: enabled ? color : 'rgba(255,255,255,0.2)',
          lineHeight: 1,
          minHeight: 22,
          transition: 'color 0.15s',
        }}
      >
        {value}
      </div>

      {enabled && children && (
        <div style={{ marginTop: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}
