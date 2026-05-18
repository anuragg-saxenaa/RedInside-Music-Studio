import React from 'react';
import EffectTile from './EffectTile';

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
  normalizeEnabled: boolean
  normalizeTargetLUFS: number
  reverbEnabled: boolean
  reverbRoomScale: number
  reverbDamping: number
  reverbWetLevel: number
  echoEnabled: boolean
  echoDelay: number
  echoDecay: number
  bassBoostEnabled: boolean
  bassBoostGainDb: number
  pitchShiftEnabled: boolean
  pitchShiftSemitones: number
  vocalRemovalEnabled: boolean
  vocalRemovalJobId: string | null
  vocalRemovalEngine: 'demucs' | 'ffmpeg' | null
  vocalRemovalInstrumentalId: string | null
}

interface ControlsSidebarProps {
  duration: number
  operations: AudioOperations
  onChange: (ops: AudioOperations) => void
  onPreview: () => void
  onExport: (format: 'mp3-320' | 'wav' | 'flac') => void
  isExporting?: boolean
}

const volumeToDb = (volume: number): string => {
  if (volume === 0) return '-∞ dB';
  const db = 20 * Math.log10(volume);
  return db >= 0 ? `+${db.toFixed(1)} dB` : `${db.toFixed(1)} dB`;
};

function ColorSlider({ value, min, max, step = 0.01, color, onChange }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min) * 100).toFixed(1) + '%';
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{
        WebkitAppearance: 'none',
        appearance: 'none',
        width: '100%',
        height: 4,
        borderRadius: 2,
        background: `linear-gradient(90deg, ${color} ${pct}, rgba(255,255,255,0.1) ${pct})`,
        outline: 'none',
        cursor: 'pointer',
      } as React.CSSProperties}
    />
  );
}

function TogglePill({ enabled, color, onToggle, label }: { enabled: boolean; color: string; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 28, height: 16, borderRadius: 8, border: 'none',
        background: enabled ? color : 'rgba(255,255,255,0.15)',
        cursor: 'pointer', position: 'relative', padding: 0,
        transition: 'background 0.15s',
        flexShrink: 0,
        boxShadow: enabled ? `0 0 6px ${color}80` : 'none',
      }}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: enabled ? 14 : 2,
        width: 12, height: 12, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s',
      }} />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 12,
  padding: '4px 8px',
  width: '100%',
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
};

const sectionLabel: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: 9,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

export default function ControlsSidebar({
  duration,
  operations: ops,
  onChange,
  onExport,
  isExporting = false,
}: ControlsSidebarProps) {
  const set = (patch: Partial<AudioOperations>) => onChange({ ...ops, ...patch });

  return (
    <div style={{
      background: '#07071a',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      overflowY: 'auto',
      height: '100%',
      boxSizing: 'border-box',
    }}>

      {/* Trim */}
      <div>
        <div style={sectionLabel}>Trim</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, marginBottom: 3, letterSpacing: '0.1em' }}>START (s)</div>
            <input
              type="number" min={0} max={duration} step={0.1}
              value={ops.trimStart.toFixed(1)}
              onChange={e => set({ trimStart: parseFloat(e.target.value) || 0 })}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, marginBottom: 3, letterSpacing: '0.1em' }}>END (s)</div>
            <input
              type="number" min={0} max={duration} step={0.1}
              value={(ops.trimEnd || duration).toFixed(1)}
              onChange={e => set({ trimEnd: parseFloat(e.target.value) || duration })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Volume */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={sectionLabel}>Volume</div>
          <span style={{ color: '#fff', fontSize: 11, fontFamily: 'monospace' }}>{volumeToDb(ops.volume)}</span>
        </div>
        <ColorSlider value={ops.volume} min={0} max={2} color="#fff"
          onChange={v => set({ volume: v })} />
      </div>

      {/* Effect tile grid */}
      <div>
        <div style={sectionLabel}>Effects</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

          <EffectTile label="REVERB" color="#E63946" enabled={ops.reverbEnabled}
            value={ops.reverbEnabled ? `${Math.round(ops.reverbWetLevel * 100)}%` : 'OFF'}
            onToggle={() => set({ reverbEnabled: !ops.reverbEnabled })}>
            <ColorSlider value={ops.reverbWetLevel} min={0} max={1} color="#E63946"
              onChange={v => set({ reverbWetLevel: v })} />
          </EffectTile>

          <EffectTile label="ECHO" color="#E63946" enabled={ops.echoEnabled}
            value={ops.echoEnabled ? `${ops.echoDelay.toFixed(1)}s` : 'OFF'}
            onToggle={() => set({ echoEnabled: !ops.echoEnabled })}>
            <ColorSlider value={ops.echoDelay} min={0.05} max={1.5} color="#E63946"
              onChange={v => set({ echoDelay: v })} />
          </EffectTile>

          <EffectTile label="BASS" color="#FFB800" enabled={ops.bassBoostEnabled}
            value={ops.bassBoostEnabled ? `+${ops.bassBoostGainDb}dB` : 'OFF'}
            onToggle={() => set({ bassBoostEnabled: !ops.bassBoostEnabled })}>
            <ColorSlider value={ops.bassBoostGainDb} min={0} max={15} step={1} color="#FFB800"
              onChange={v => set({ bassBoostGainDb: v })} />
          </EffectTile>

          <EffectTile label="PITCH" color="#a78bfa" enabled={ops.pitchShiftEnabled}
            value={ops.pitchShiftEnabled ? `${ops.pitchShiftSemitones > 0 ? '+' : ''}${ops.pitchShiftSemitones}st` : 'OFF'}
            onToggle={() => set({ pitchShiftEnabled: !ops.pitchShiftEnabled })}>
            <ColorSlider value={ops.pitchShiftSemitones} min={-12} max={12} step={1} color="#a78bfa"
              onChange={v => set({ pitchShiftSemitones: v })} />
          </EffectTile>

          <EffectTile label="NORMALIZE" color="#00D26A" enabled={ops.normalizeEnabled}
            value={ops.normalizeEnabled ? `${ops.normalizeTargetLUFS}L` : 'OFF'}
            onToggle={() => set({ normalizeEnabled: !ops.normalizeEnabled })}>
            <ColorSlider value={ops.normalizeTargetLUFS} min={-24} max={-6} step={1} color="#00D26A"
              onChange={v => set({ normalizeTargetLUFS: v })} />
          </EffectTile>

          <EffectTile label="SPEED" color="#60a5fa" enabled={ops.speed !== 1.0}
            value={`${ops.speed.toFixed(2)}x`}
            onToggle={() => set({ speed: ops.speed === 1.0 ? 1.25 : 1.0 })}>
            <ColorSlider value={ops.speed} min={0.5} max={2.0} step={0.05} color="#60a5fa"
              onChange={v => set({ speed: v })} />
          </EffectTile>

        </div>
      </div>

      {/* Fades */}
      <div>
        <div style={sectionLabel}>Fades</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <EffectTile label="FADE IN" color="#60a5fa" enabled={ops.fadeInEnabled}
            value={ops.fadeInEnabled ? `${ops.fadeInDuration.toFixed(1)}s` : 'OFF'}
            onToggle={() => set({ fadeInEnabled: !ops.fadeInEnabled })}>
            <ColorSlider value={ops.fadeInDuration} min={0.1} max={10} step={0.1} color="#60a5fa"
              onChange={v => set({ fadeInDuration: v })} />
          </EffectTile>
          <EffectTile label="FADE OUT" color="#60a5fa" enabled={ops.fadeOutEnabled}
            value={ops.fadeOutEnabled ? `${ops.fadeOutDuration.toFixed(1)}s` : 'OFF'}
            onToggle={() => set({ fadeOutEnabled: !ops.fadeOutEnabled })}>
            <ColorSlider value={ops.fadeOutDuration} min={0.1} max={10} step={0.1} color="#60a5fa"
              onChange={v => set({ fadeOutDuration: v })} />
          </EffectTile>
        </div>
      </div>

      {/* Reverse */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: ops.reverse ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${ops.reverse ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>REVERSE</span>
        <TogglePill enabled={ops.reverse} color="#a78bfa" onToggle={() => set({ reverse: !ops.reverse })} label="Reverse" />
      </div>

      {/* Export */}
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', marginBottom: 2 }}>
          Preview ≈ · Export exact
        </div>
        {(['mp3-320', 'wav', 'flac'] as const).map(fmt => (
          <button key={fmt} onClick={() => onExport(fmt)} disabled={isExporting}
            style={{
              background: fmt === 'mp3-320' ? 'linear-gradient(135deg,#E63946,#c0392b)' : 'rgba(255,255,255,0.05)',
              border: fmt === 'mp3-320' ? 'none' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: '#fff',
              fontSize: 11, fontWeight: fmt === 'mp3-320' ? 700 : 400,
              padding: '8px 16px', cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.5 : 1,
              boxShadow: fmt === 'mp3-320' ? '0 0 12px rgba(230,57,70,0.3)' : 'none',
              transition: 'opacity 0.15s',
            }}>
            {isExporting && fmt === 'mp3-320' ? 'Exporting...' : fmt === 'mp3-320' ? 'Export 320K MP3' : fmt === 'wav' ? 'Export WAV' : 'Export FLAC'}
          </button>
        ))}
      </div>

    </div>
  );
}
