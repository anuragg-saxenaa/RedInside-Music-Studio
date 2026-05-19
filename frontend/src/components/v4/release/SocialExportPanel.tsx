import { useState } from 'react';
import { C } from '../shared/colors';
import type { MusicGeneration } from '../../../types';

const PRESETS = [
  { id: 'tiktok',  label: 'TikTok',          desc: '60s clip' },
  { id: 'reels',   label: 'Instagram Reels',  desc: '30s clip' },
  { id: 'shorts',  label: 'YouTube Shorts',   desc: '60s clip' },
  { id: 'full',    label: 'Full Track',        desc: 'No trim' },
];

interface SocialExportPanelProps {
  track: MusicGeneration | null;
}

export default function SocialExportPanel({ track }: SocialExportPanelProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportTrack = async (preset: string) => {
    if (!track) return;
    setExporting(preset);
    setError(null);
    try {
      const res = await fetch('/api/audio/social-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: track.id, preset }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(track.title || 'track').replace(/[^a-zA-Z0-9-_]/g, '_')}_${preset}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div data-testid="social-export-panel">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        Social Export Presets
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => exportTrack(p.id)}
            disabled={!track || exporting === p.id}
            data-testid={`export-${p.id}`}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '8px',
              padding: '12px', cursor: track ? 'pointer' : 'not-allowed', textAlign: 'left',
              opacity: !track ? 0.5 : 1,
            }}
          >
            <div style={{ color: exporting === p.id ? C.gold : C.text, fontSize: '12px', fontWeight: 600 }}>
              {exporting === p.id ? 'Exporting…' : p.label}
            </div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
