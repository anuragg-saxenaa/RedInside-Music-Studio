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
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

const speedPresets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

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
    setTrimEndInput(formatTimeMs(duration));
    onChange({ ...operations, trimStart: 0, trimEnd: duration });
  };

  const handleSpeedChange = (speed: number) => {
    onChange({ ...operations, speed });
  };

  const handleVolumeChange = (volume: number) => {
    onChange({ ...operations, volume });
  };

  const handleFadeInToggle = () => {
    onChange({ ...operations, fadeInEnabled: !operations.fadeInEnabled });
  };

  const handleFadeInDurationChange = (duration: number) => {
    onChange({ ...operations, fadeInDuration: duration });
  };

  const handleFadeOutToggle = () => {
    onChange({ ...operations, fadeOutEnabled: !operations.fadeOutEnabled });
  };

  const handleFadeOutDurationChange = (duration: number) => {
    onChange({ ...operations, fadeOutDuration: duration });
  };

  const handleReverseToggle = () => {
    onChange({ ...operations, reverse: !operations.reverse });
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
        <h3 style={styles.title}>Audio Controls</h3>
      </div>

      {/* Trim Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Trim</span>
          <button onClick={handleResetTrim} style={styles.resetButton}>
            Reset
          </button>
        </div>

        <div style={styles.trimInputs}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Start</label>
            <input
              type="text"
              value={trimStartInput}
              onChange={(e) => handleTrimStartChange(e.target.value)}
              placeholder="0:00.00"
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>End</label>
            <input
              type="text"
              value={trimEndInput}
              onChange={(e) => handleTrimEndChange(e.target.value)}
              placeholder={`${Math.floor(duration / 60)}:${(duration % 60).toFixed(2).padStart(5, '0')}`}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.trimInfo}>
          <span style={styles.infoText}>
            Duration: {formatTimeMs(trimmedDuration)}
          </span>
        </div>
      </div>

      {/* Speed Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Speed</span>
          <span style={styles.valueDisplay}>{operations.speed.toFixed(2)}x</span>
        </div>

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
          <span style={styles.infoText}>
            Adjusted: {formatTimeMs(adjustedDuration)}
          </span>
        </div>
      </div>

      {/* Volume Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Volume</span>
          <span style={styles.valueDisplay}>{volumeToDb(operations.volume)}</span>
        </div>

        <input
          type="range"
          min="0"
          max="2.0"
          step="0.1"
          value={operations.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          style={styles.slider}
        />

        <div style={styles.volumeLabels}>
          <span style={styles.infoText}>0%</span>
          <span style={styles.infoText}>100%</span>
          <span style={styles.infoText}>200%</span>
        </div>
      </div>

      {/* Effects Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Effects</div>

        {/* Fade In */}
        <div style={styles.effectRow}>
          <div style={styles.effectHeader}>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={operations.fadeInEnabled}
                onChange={handleFadeInToggle}
                style={styles.checkbox}
              />
              Fade In
            </label>
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
              <span style={styles.unitLabel}>sec</span>
            </div>
          )}
        </div>

        {/* Fade Out */}
        <div style={styles.effectRow}>
          <div style={styles.effectHeader}>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={operations.fadeOutEnabled}
                onChange={handleFadeOutToggle}
                style={styles.checkbox}
              />
              Fade Out
            </label>
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
              <span style={styles.unitLabel}>sec</span>
            </div>
          )}
        </div>

        {/* Reverse */}
        <div style={styles.effectRow}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={operations.reverse}
              onChange={handleReverseToggle}
              style={styles.checkbox}
            />
            Reverse
          </label>
        </div>
      </div>

      {/* Preview + Export Section */}
      <div style={styles.section}>
        <button onClick={onPreview} style={styles.previewButton}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Preview
        </button>

        <div style={styles.exportContainer}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            style={styles.exportButton}
          >
            {isExporting ? (
              <>
                <div style={styles.spinner} />
                Exporting...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
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
                320kbps
              </button>
              <button
                onClick={() => handleExport('wav')}
                style={styles.exportMenuItem}
              >
                <span style={styles.formatBadge}>WAV</span>
                Lossless
              </button>
              <button
                onClick={() => handleExport('flac')}
                style={styles.exportMenuItem}
              >
                <span style={styles.formatBadge}>FLAC</span>
                Lossless
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #2A2A2A',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minWidth: '260px',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'Outfit, sans-serif',
    margin: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#A0A0A0',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  valueDisplay: {
    color: '#E63946',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
  },
  resetButton: {
    background: 'none',
    border: '1px solid #2A2A2A',
    borderRadius: '4px',
    color: '#A0A0A0',
    fontSize: '10px',
    padding: '2px 8px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  trimInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    color: '#666666',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#FFFFFF',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  trimInfo: {
    display: 'flex',
    justifyContent: 'center',
  },
  infoText: {
    color: '#666666',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  slider: {
    width: '100%',
    height: '6px',
    accentColor: '#E63946',
    cursor: 'pointer',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  presetButton: {
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    color: '#A0A0A0',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    padding: '6px 4px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  presetButtonActive: {
    backgroundColor: '#E63946',
    borderColor: '#E63946',
    color: '#FFFFFF',
  },
  volumeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  effectRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #2A2A2A',
  },
  effectHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  effectInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#FFFFFF',
    fontSize: '12px',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: '#E63946',
    width: '14px',
    height: '14px',
    cursor: 'pointer',
  },
  smallInput: {
    width: '60px',
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '4px',
    padding: '4px 8px',
    color: '#FFFFFF',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
  },
  unitLabel: {
    color: '#666666',
    fontSize: '10px',
  },
  previewButton: {
    width: '100%',
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    border: '1px solid rgba(230, 57, 70, 0.3)',
    borderRadius: '8px',
    color: '#E63946',
    fontSize: '13px',
    fontWeight: 500,
    padding: '12px',
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
    backgroundColor: '#E63946',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    padding: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 150ms',
  },
  exportMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: '8px',
    backgroundColor: '#1E1E1E',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 10,
  },
  exportMenuItem: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '12px',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'background 150ms',
  },
  formatBadge: {
    backgroundColor: '#E63946',
    color: '#FFFFFF',
    fontSize: '9px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'JetBrains Mono, monospace',
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