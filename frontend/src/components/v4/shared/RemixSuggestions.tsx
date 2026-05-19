import { C } from './colors';

interface AudioOperations {
  reverbEnabled?: boolean;
  reverbRoomScale?: number;
  reverbWetLevel?: number;
  bassBoostEnabled?: boolean;
  bassBoostGainDb?: number;
  pitchShiftEnabled?: boolean;
  pitchShiftSemitones?: number;
  normalizeEnabled?: boolean;
  normalizeTargetLUFS?: number;
}

const PRESETS: { label: string; description: string; ops: AudioOperations }[] = [
  {
    label: 'Lo-fi Chill',
    description: 'Warm reverb, soft bass',
    ops: { reverbEnabled: true, reverbRoomScale: 40, reverbWetLevel: 0.25, bassBoostEnabled: true, bassBoostGainDb: 3 },
  },
  {
    label: 'Stadium Reverb',
    description: 'Big hall sound',
    ops: { reverbEnabled: true, reverbRoomScale: 90, reverbWetLevel: 0.5 },
  },
  {
    label: 'Gym Energy',
    description: 'Punchy bass, normalized',
    ops: { bassBoostEnabled: true, bassBoostGainDb: 8, normalizeEnabled: true, normalizeTargetLUFS: -10 },
  },
];

interface RemixSuggestionsProps {
  onApply: (ops: AudioOperations) => void;
}

export default function RemixSuggestions({ onApply }: RemixSuggestionsProps) {
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        AI Remix Suggestions
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => onApply(preset.ops)}
            data-testid={`remix-${preset.label.toLowerCase().replace(/ /g, '-')}`}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '8px', padding: '10px 8px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 150ms',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderActive; (e.currentTarget as HTMLButtonElement).style.background = C.glassActive; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <div style={{ color: C.text, fontSize: '12px', fontWeight: 600 }}>{preset.label}</div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
