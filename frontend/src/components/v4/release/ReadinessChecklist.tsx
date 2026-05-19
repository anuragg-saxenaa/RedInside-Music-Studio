import { C } from '../shared/colors';
import type { MusicGeneration } from '../../../types';

interface ReadinessChecklistProps {
  track: MusicGeneration | null;
  artworkUrl?: string | null;
  hasLyrics?: boolean;
}

export default function ReadinessChecklist({ track, artworkUrl, hasLyrics }: ReadinessChecklistProps) {
  if (!track) return null;

  const checks = [
    { label: 'Has artwork',        pass: !!artworkUrl },
    { label: 'Has lyrics',         pass: !!hasLyrics },
    { label: 'Duration > 60s',     pass: (track.duration_seconds ?? 0) > 60 },
    { label: 'Title is not generic', pass: !!(track.title && !/^(version|track|v)\s*\d*/i.test(track.title)) },
    { label: 'Audio file exists',  pass: !!(track.original_file_path || (track as any).processed_file_path) },
  ];

  const passed = checks.filter(c => c.pass).length;

  return (
    <div data-testid="readiness-checklist">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        Release Readiness — {passed}/{checks.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: c.pass ? '#4ade80' : C.textDim }}>
            <span>{c.pass ? '✅' : '⚠️'}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
