import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicNote, MusicTags } from '../../../types';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RightPanel() {
  const { selectedTrack, playTrack, setActiveTab, playerCurrentTime, activeProjectId } = useWorkspace();
  const [notes, setNotes] = useState<MusicNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [tags, setTags] = useState<MusicTags>({ bpm: null, key: null, mood: null });
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTrack) return;
    setNotes([]);
    setTags({ bpm: null, key: null, mood: null });
    fetch(`/api/music/${selectedTrack.id}/notes`).then(r => r.json()).then(setNotes).catch(() => {});
    fetch(`/api/music/${selectedTrack.id}/tags`).then(r => r.json()).then(setTags).catch(() => {});
  }, [selectedTrack?.id]);

  const addNote = async () => {
    if (!selectedTrack || !newNoteText.trim()) return;
    const res = await fetch(`/api/music/${selectedTrack.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: playerCurrentTime, text: newNoteText.trim() }),
    });
    const note: MusicNote = await res.json();
    setNotes(prev => [...prev, note].sort((a, b) => a.timestamp_sec - b.timestamp_sec));
    setNewNoteText('');
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedTrack) return;
    await fetch(`/api/music/${selectedTrack.id}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const generateShare = async () => {
    if (!activeProjectId) return;
    const res = await fetch(`/api/projects/${activeProjectId}/share`, { method: 'POST' });
    const data = await res.json();
    setShareUrl(`${window.location.origin}/#/share/${data.token}`);
  };

  if (!selectedTrack) {
    return (
      <GlassPanel style={{ padding: '16px', height: '100%' }}>
        <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', marginTop: '48px' }}>
          Select a track to see details
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'auto' }} data-testid="right-panel-track">
      {/* Track card */}
      <div>
        <div style={{
          width: '100%', aspectRatio: '1', background: `linear-gradient(135deg, ${C.redDark}, #0a0102)`,
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '12px', border: `1px solid ${C.border}`,
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="15" stroke={C.border} strokeWidth="2"/>
            <circle cx="20" cy="20" r="5" fill={C.red} opacity="0.5"/>
          </svg>
        </div>

        <div style={{ color: C.text, fontSize: '14px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedTrack.title || `Track v${selectedTrack.version}`}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {tags.bpm && <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.gold }}>{Math.round(tags.bpm)} BPM</span>}
          {tags.key && <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.text }}>{tags.key}</span>}
          {selectedTrack.duration_seconds != null && (
            <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.textDim }}>
              {fmtTime(selectedTrack.duration_seconds)}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          { label: '▶ Play',    action: () => playTrack(selectedTrack), testId: 'action-play' },
          { label: '✎ Edit',   action: () => setActiveTab('craft'),    testId: 'action-edit' },
          { label: '⬆ Master', action: () => setActiveTab('release'),  testId: 'action-master' },
          { label: '📤 Export', action: () => setActiveTab('release'),  testId: 'action-export' },
        ].map(({ label, action, testId }) => (
          <button
            key={testId}
            onClick={action}
            data-testid={testId}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '6px',
              color: C.text, padding: '8px 6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderActive; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
          >{label}</button>
        ))}
      </div>

      {/* Share */}
      <div>
        <button
          onClick={generateShare}
          data-testid="action-share"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            borderRadius: '6px', color: C.textDim, padding: '8px', fontSize: '11px', cursor: 'pointer',
          }}
        >🔗 Generate Share Link</button>
        {shareUrl && (
          <div
            onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
            data-testid="share-url"
            style={{
              marginTop: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px',
              color: C.gold, fontSize: '10px', cursor: 'pointer', wordBreak: 'break-all',
            }}
            title="Click to copy"
          >{shareUrl}</div>
        )}
      </div>

      {/* Track notes */}
      <div>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          Track Notes
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder={`Note at ${fmtTime(playerCurrentTime)}…`}
            data-testid="note-input"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '11px', outline: 'none',
            }}
          />
          <button
            onClick={addNote}
            disabled={!newNoteText.trim()}
            data-testid="add-note-btn"
            style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
          >+</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {notes.map(n => (
            <div key={n.id} data-testid={`note-${n.id}`}
              style={{ display: 'flex', gap: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: C.gold, fontFamily: 'monospace', flexShrink: 0 }}>{fmtTime(n.timestamp_sec)}</span>
              <span style={{ color: C.text, flex: 1 }}>{n.text}</span>
              <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
