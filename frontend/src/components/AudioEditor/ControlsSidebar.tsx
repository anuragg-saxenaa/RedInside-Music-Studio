import { useState, useEffect } from 'react';

export interface AudioOperations {
  trimStart: number
  trimEnd: number
  speed: number
  volume: number
  fadeInEnabled: boolean
  fadeInDuration: number
  fadeOutEnabled: boolean
  fadeOutDuration: number
  reverse: boolean
}

interface ControlsSidebarProps {
  duration: number
  operations: AudioOperations
  onChange: (ops: AudioOperations) => void
  onPreview: () => void
  onExport: (format: 'mp3-320' | 'wav' | 'flac') => void
  isExporting?: boolean
}

const formatTimeMs = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const parseTimeInput = (value: string): number | null => {
  const match = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseFloat(match[2]);
  return mins * 60 + secs;
};

const volumeToDb = (volume: number): string => {
  if (volume === 0) return '-∞ dB';
  const db = 20 * Math.log10(volume);
  if (db >= 0) return `+${db.toFixed(1)} dB`;
  return `${db.toFixed(1)} dB`;
};

const speedPresets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

interface SectionProps {
  title: string
  value?: string
  children: React.ReactNode
  noBorder?: boolean
}

function Section({ title, value, children, noBorder }: SectionProps) {
  return (
    <div style={{ ...styles.section, ...(noBorder ? {} : { borderBottom: '1px solid #2a2a2a' }) }}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>{title}</span>
        {value && <span style={styles.valueDisplay}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ControlsSidebar({
  duration,
  operations,
  onChange,
  onPreview,
  onExport,
  isExporting = false,
}: ControlsSidebarProps) {
  const [trimStartInput, setTrimStartInput] = useState(formatTimeMs(operations.trimStart));
  const [trimEndInput, setTrimEndInput] = useState(formatTimeMs(operations.trimEnd));
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setTrimStartInput(formatTimeMs(operations.trimStart));
  }, [operations.trimStart]);

  useEffect(() => {
    setTrimEndInput(formatTimeMs(operations.trimEnd));
  }, [operations.trimEnd]);

  const handleTrimStartChange = (value: string) => {
    setTrimStartInput(value);
    const seconds = parseTimeInput(value);
    if (seconds !== null && seconds >= 0 && seconds < operations.trimEnd) {
      onChange({ ...operations, trimStart: seconds });
    }
  };

  const handleTrimEndChange = (value: string) => {
    setTrimEndInput(value);
    const seconds = parseTimeInput(value);
    if (seconds !== null && seconds > operations.trimStart && seconds <= duration) {
      onChange({ ...operations, trimEnd: seconds });
    }
  };

  const handleResetTrim = () => {
    setTrimStartInput(formatTimeMs(0));
    setTrimEndInput(formatTimeMs(duration || 0));
    onChange({ ...operations, trimStart: 0, trimEnd: duration || 0 });
  };

  const handleSpeedChange = (speed: number) => {
    onChange({ ...operations, speed });
  };

  const handleVolumeChange = (volume: number) => {
    // Clamp to 100% max to prevent audio context issues
    const clampedVolume = Math.min(1.0, Math.max(0, volume));
    onChange({ ...operations, volume: clampedVolume });
  };

  const handleFadeInDurationChange = (durationSec: number) => {
    onChange({ ...operations, fadeInDuration: durationSec });
  };

  const handleFadeOutDurationChange = (durationSec: number) => {
    onChange({ ...operations, fadeOutDuration: durationSec });
  };

  const handleExport = (format: 'mp3-320' | 'wav' | 'flac') => {
    setShowExportMenu(false);
    onExport(format);
  };

  const trimmedDuration = operations.trimEnd - operations.trimStart;
  const adjustedDuration = trimmedDuration / operations.speed;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerAccent} />
        <h3 style={styles.title}>CONTROLS</h3>
      </div>

      <Section title="TRIM" value={formatTimeMs(trimmedDuration)}>
        <div style={styles.trimInputs}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>START</label>
            <input
              type="text"
              value={trimStartInput}
              onChange={(e) => handleTrimStartChange(e.target.value)}
              placeholder="0:00.00"
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>END</label>
            <input
              type="text"
              value={trimEndInput}
              onChange={(e) => handleTrimEndChange(e.target.value)}
              placeholder={`${Math.floor((duration || 0) / 60)}:${((duration || 0) % 60).toFixed(2).padStart(5, '0')}`}
              style={styles.input}
            />
          </div>
        </div>
        <button onClick={handleResetTrim} style={styles.resetButton}>
          RESET TRIM
        </button>
      </Section>

      <Section title="SPEED" value={`${operations.speed.toFixed(2)}x`}>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={operations.speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.presetRow}>
          {speedPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => handleSpeedChange(preset)}
              style={{
                ...styles.presetButton,
                ...(operations.speed === preset ? styles.presetButtonActive : {}),
              }}
            >
              {preset}x
            </button>
          ))}
        </div>
        <div style={styles.trimInfo}>
          <span style={styles.infoText}>Adjusted: {formatTimeMs(adjustedDuration)}</span>
        </div>
      </Section>

      <Section title="VOLUME" value={volumeToDb(operations.volume)}>
        <input
          type="range"
          min="0"
          max="1.0"
          step="0.05"
          value={operations.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.volumeLabels}>
          <span style={styles.volumeLabel}>0%</span>
          <span style={styles.volumeLabel}>50%</span>
          <span style={styles.volumeLabel}>100%</span>
        </div>
      </Section>

      <Section title="EFFECTS" noBorder>
        <div style={styles.effectsGrid}>
          {/* Fade In */}
          <div style={styles.effectRow}>
            <div
              style={styles.toggleLabel}
              onClick={() => onChange({ ...operations, fadeInEnabled: !operations.fadeInEnabled })}
            >
              <div
                style={{
                  ...styles.toggleSwitch,
                  background: operations.fadeInEnabled
                    ? 'linear-gradient(180deg, #00D26A 0%, #00AA50 100%)'
                    : '#2A2A2A',
                  boxShadow: operations.fadeInEnabled
                    ? '0 0 12px rgba(0, 210, 106, 0.4)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    transform: operations.fadeInEnabled ? 'translateX(14px)' : 'translateX(0)',
                  }}
                />
              </div>
              <span style={{ color: operations.fadeInEnabled ? '#00D26A' : '#888' }}>FADE IN</span>
            </div>
            {operations.fadeInEnabled && (
              <div style={styles.effectInput}>
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={operations.fadeInDuration}
                  onChange={(e) => handleFadeInDurationChange(parseFloat(e.target.value) || 0)}
                  style={styles.smallInput}
                />
                <span style={styles.unitLabel}>SEC</span>
              </div>
            )}
          </div>

          {/* Fade Out */}
          <div style={styles.effectRow}>
            <div
              style={styles.toggleLabel}
              onClick={() => onChange({ ...operations, fadeOutEnabled: !operations.fadeOutEnabled })}
            >
              <div
                style={{
                  ...styles.toggleSwitch,
                  background: operations.fadeOutEnabled
                    ? 'linear-gradient(180deg, #00D26A 0%, #00AA50 100%)'
                    : '#2A2A2A',
                  boxShadow: operations.fadeOutEnabled
                    ? '0 0 12px rgba(0, 210, 106, 0.4)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    transform: operations.fadeOutEnabled ? 'translateX(14px)' : 'translateX(0)',
                  }}
                />
              </div>
              <span style={{ color: operations.fadeOutEnabled ? '#00D26A' : '#888' }}>FADE OUT</span>
            </div>
            {operations.fadeOutEnabled && (
              <div style={styles.effectInput}>
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={operations.fadeOutDuration}
                  onChange={(e) => handleFadeOutDurationChange(parseFloat(e.target.value) || 0)}
                  style={styles.smallInput}
                />
                <span style={styles.unitLabel}>SEC</span>
              </div>
            )}
          </div>

          {/* Reverse */}
          <div style={styles.effectRow}>
            <div
              style={styles.toggleLabel}
              onClick={() => onChange({ ...operations, reverse: !operations.reverse })}
            >
              <div
                style={{
                  ...styles.toggleSwitch,
                  background: operations.reverse
                    ? 'linear-gradient(180deg, #E63946 0%, #B8232E 100%)'
                    : '#2A2A2A',
                  boxShadow: operations.reverse
                    ? '0 0 12px rgba(230, 57, 70, 0.4)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    transform: operations.reverse ? 'translateX(14px)' : 'translateX(0)',
                  }}
                />
              </div>
              <span style={{ color: operations.reverse ? '#E63946' : '#888' }}>REVERSE</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Action buttons */}
      <div style={styles.actionSection}>
        <button onClick={onPreview} style={styles.previewButton}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          PREVIEW
        </button>

        <div style={styles.exportContainer}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            style={{
              ...styles.exportButton,
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? (
              <>
                <div style={styles.spinner} />
                PROCESSING...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                EXPORT
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 9 12 15 18 9 6 9" />
                </svg>
              </>
            )}
          </button>

          {showExportMenu && (
            <div style={styles.exportMenu}>
              <button
                onClick={() => handleExport('mp3-320')}
                style={styles.exportMenuItem}
              >
                <span style={styles.formatBadge}>MP3</span>
                <span>320kbps</span>
                <span style={styles.formatHint}>Standard</span>
              </button>
              <button
                onClick={() => handleExport('wav')}
                style={styles.exportMenuItem}
              >
                <span style={{ ...styles.formatBadge, background: '#3366FF' }}>WAV</span>
                <span>Lossless</span>
                <span style={styles.formatHint}>Best quality</span>
              </button>
              <button
                onClick={() => handleExport('flac')}
                style={styles.exportMenuItem}
              >
                <span style={{ ...styles.formatBadge, background: '#00AA00' }}>FLAC</span>
                <span>Lossless</span>
                <span style={styles.formatHint}>Smaller</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '280px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'linear-gradient(180deg, #222 0%, #1a1a1a 100%)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #2a2a2a',
  },
  headerAccent: {
    width: '3px',
    height: '16px',
    background: 'linear-gradient(180deg, #E63946 0%, #B8232E 100%)',
    borderRadius: '2px',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'Bebas Neue, sans-serif',
    letterSpacing: '2px',
    margin: 0,
  },
  section: {
    padding: '14px 16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  sectionTitle: {
    color: '#666',
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: 'JetBrains Mono, monospace',
    letterSpacing: '1px',
  },
  valueDisplay: {
    color: '#E63946',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
  },
  trimInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '10px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    color: '#555',
    fontSize: '9px',
    fontFamily: 'JetBrains Mono, monospace',
    letterSpacing: '0.5px',
  },
  input: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#00FF00',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
  },
  resetButton: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#666',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    letterSpacing: '0.5px',
    padding: '6px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  slider: {
    width: '100%',
    height: '4px',
    appearance: 'none',
    background: '#2a2a2a',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
    marginTop: '10px',
  },
  presetButton: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    color: '#666',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    padding: '8px 4px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  presetButtonActive: {
    backgroundColor: '#E63946',
    borderColor: '#E63946',
    color: '#FFFFFF',
    boxShadow: '0 0 8px rgba(230, 57, 70, 0.4)',
  },
  volumeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  volumeLabel: {
    color: '#555',
    fontSize: '9px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  effectsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  effectRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#888',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
  },
  toggleSwitch: {
    width: '32px',
    height: '18px',
    borderRadius: '9px',
    position: 'relative',
    transition: 'all 200ms',
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '14px',
    height: '14px',
    background: '#FFFFFF',
    borderRadius: '50%',
    transition: 'transform 200ms',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  effectInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  smallInput: {
    width: '50px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    padding: '4px 8px',
    color: '#00FF00',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    textAlign: 'center',
  },
  unitLabel: {
    color: '#555',
    fontSize: '9px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  trimInfo: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '8px',
  },
  infoText: {
    color: '#555',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  actionSection: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
    borderTop: '1px solid #2a2a2a',
  },
  previewButton: {
    width: '100%',
    background: 'linear-gradient(180deg, rgba(230, 57, 70, 0.15) 0%, rgba(230, 57, 70, 0.05) 100%)',
    border: '1px solid rgba(230, 57, 70, 0.4)',
    borderRadius: '8px',
    color: '#E63946',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Bebas Neue, sans-serif',
    letterSpacing: '1px',
    padding: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 150ms',
  },
  exportContainer: {
    position: 'relative',
  },
  exportButton: {
    width: '100%',
    background: 'linear-gradient(180deg, #E63946 0%, #B8232E 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Bebas Neue, sans-serif',
    letterSpacing: '1px',
    padding: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 150ms',
    boxShadow: '0 4px 12px rgba(230, 57, 70, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  exportMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: '8px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    animation: 'slideIn 150ms ease',
  },
  exportMenuItem: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '12px',
    padding: '12px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'background 150ms',
    borderBottom: '1px solid #2a2a2a',
  },
  formatBadge: {
    backgroundColor: '#E63946',
    color: '#FFFFFF',
    fontSize: '9px',
    fontWeight: 700,
    padding: '3px 6px',
    borderRadius: '4px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  formatHint: {
    color: '#555',
    fontSize: '10px',
    marginLeft: 'auto',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};