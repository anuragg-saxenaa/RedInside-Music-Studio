import { useState, useRef } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

export default function ABComparator() {
  const { tracks } = useWorkspace();
  const [slotA, setSlotA] = useState<MusicGeneration | null>(null);
  const [slotB, setSlotB] = useState<MusicGeneration | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSlot = (slot: 'A' | 'B') => {
    const track = slot === 'A' ? slotA : slotB;
    if (!track) return;
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(`/api/music/${track.id}/file`);
    audio.play().catch(() => {});
    audioRef.current = audio;
    setActiveSlot(slot);
  };

  const swap = () => {
    const tmp = slotA;
    setSlotA(slotB);
    setSlotB(tmp);
  };

  return (
    <GlassPanel style={{ padding: '12px', marginTop: '8px' }} data-testid="ab-comparator">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '8px' }}>
        A/B Compare
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['A', 'B'] as const).map(slot => {
          const track = slot === 'A' ? slotA : slotB;
          const setter = slot === 'A' ? setSlotA : setSlotB;
          return (
            <div key={slot} style={{ flex: 1 }}>
              <select
                value={track?.id ?? ''}
                onChange={e => setter(tracks.find(t => t.id === e.target.value) ?? null)}
                data-testid={`ab-slot-${slot.toLowerCase()}`}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                  borderRadius: '6px', color: C.text, padding: '6px 8px', fontSize: '11px', outline: 'none',
                }}
              >
                <option value="">Slot {slot}</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.title || `v${t.version}`}</option>)}
              </select>
              <button
                onClick={() => playSlot(slot)}
                disabled={!track}
                style={{
                  marginTop: '4px', width: '100%', background: activeSlot === slot ? C.red : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: '6px', color: '#fff', padding: '6px', fontSize: '11px',
                  cursor: track ? 'pointer' : 'not-allowed', fontWeight: 600,
                }}
              >▶ Play {slot}</button>
            </div>
          );
        })}
        <button
          onClick={swap}
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '8px', cursor: 'pointer', fontSize: '14px' }}
          title="Swap slots"
        >⇄</button>
      </div>
    </GlassPanel>
  );
}
