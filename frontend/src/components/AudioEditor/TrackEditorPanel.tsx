'use client';

import { useState } from 'react';
import ControlsSidebar from './ControlsSidebar';

interface Track {
  id: string;
  sourceFilePath: string;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  durationSeconds?: number;
}

interface TrackEditorPanelProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  onRemove: () => void;
}

export default function TrackEditorPanel({ track, onUpdate, onRemove }: TrackEditorPanelProps) {
  const [settings, setSettings] = useState({
    trimStart: track.trimStart,
    trimEnd: track.trimEnd,
    speed: track.speed,
    volume: track.volume,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
    reverse: false,
  });

  return (
    <div style={{
      backgroundColor: '#1E1E1E',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #2A2A2A',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h4 style={{ color: '#FFFFFF', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
          Edit Track
        </h4>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#E63946',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Remove
        </button>
      </div>

      <ControlsSidebar
        duration={track.durationSeconds || 0}
        operations={{
          trimStart: settings.trimStart,
          trimEnd: settings.trimEnd,
          speed: settings.speed,
          volume: settings.volume,
          fadeInEnabled: settings.fadeIn > 0,
          fadeInDuration: settings.fadeIn,
          fadeOutEnabled: settings.fadeOut > 0,
          fadeOutDuration: settings.fadeOut,
          reverse: settings.reverse,
          normalizeEnabled: false,
          normalizeTargetLUFS: -14,
          reverbEnabled: false,
          reverbRoomScale: 50,
          reverbDamping: 50,
          reverbWetLevel: 0.3,
          echoEnabled: false,
          echoDelay: 0.3,
          echoDecay: 0.5,
          bassBoostEnabled: false,
          bassBoostGainDb: 6,
          pitchShiftEnabled: false,
          pitchShiftSemitones: 0,
          vocalRemovalEnabled: false,
          vocalRemovalJobId: null,
          vocalRemovalEngine: null,
          vocalRemovalInstrumentalId: null,
        }}
        onChange={(ops) => {
          setSettings({
            trimStart: ops.trimStart,
            trimEnd: ops.trimEnd,
            speed: ops.speed,
            volume: ops.volume,
            fadeIn: ops.fadeInDuration,
            fadeOut: ops.fadeOutDuration,
            reverse: ops.reverse,
          });
          onUpdate({
            trimStart: ops.trimStart,
            trimEnd: ops.trimEnd,
            speed: ops.speed,
            volume: ops.volume,
            fadeIn: ops.fadeInDuration,
            fadeOut: ops.fadeOutDuration,
          });
        }}
        onPreview={() => {}}
        onExport={() => {}}
      />
    </div>
  );
}
