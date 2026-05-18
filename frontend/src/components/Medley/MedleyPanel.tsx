import { useState, useEffect } from 'react';
import type { MusicGeneration } from '../../types';

// ── Types ──────────────────────────────────────────────────────────────────

interface MedleyTrack {
  id: string;
  medley_id: string;
  source_file_path: string;
  order_index: number;
  duration_seconds?: number;
  fade_in?: number;
  fade_out?: number;
  volume?: number;
  speed?: number;
}

interface Medley {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  total_duration?: number;
  track_count?: number;
  output_file_path?: string;
  created_at: string;
  tracks?: MedleyTrack[];
}

interface MedleyPanelProps {
  projectId: string;
  musicList: MusicGeneration[];
}

// ── Icons ──────────────────────────────────────────────────────────────────

const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="2" y="2" width="2" height="2" rx="1"/>
    <rect x="6" y="2" width="2" height="2" rx="1"/>
    <rect x="10" y="2" width="2" height="2" rx="1"/>
    <rect x="2" y="6" width="2" height="2" rx="1"/>
    <rect x="6" y="6" width="2" height="2" rx="1"/>
    <rect x="10" y="6" width="2" height="2" rx="1"/>
    <rect x="2" y="10" width="2" height="2" rx="1"/>
    <rect x="6" y="10" width="2" height="2" rx="1"/>
    <rect x="10" y="10" width="2" height="2" rx="1"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const MixIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h4m0 0v16m0-16l8 8m0 0l-8 8m8-8h10"/>
    <circle cx="18" cy="12" r="2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(sec?: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function trackLabel(track: MedleyTrack, musicList: MusicGeneration[], index: number): string {
  const match = musicList.find(m =>
    m.processed_file_path === track.source_file_path ||
    m.original_file_path === track.source_file_path
  );
  if (match) return `v${match.version}`;
  const basename = track.source_file_path?.split('/').pop() || '';
  return basename.replace(/\.[^.]+$/, '') || `Track ${index + 1}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MedleyPanel({ projectId, musicList }: MedleyPanelProps) {
  const [medleys, setMedleys] = useState<Medley[]>([]);
  const [selected, setSelected] = useState<Medley | null>(null);
  const [tracks, setTracks] = useState<MedleyTrack[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savingToMusic, setSavingToMusic] = useState(false);
  const [savedToMusic, setSavedToMusic] = useState(false);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [deletingMedleyId, setDeletingMedleyId] = useState<string | null>(null);

  // ── Load medleys ────────────────────────────────────────────────────────

  const loadMedleys = async () => {
    const res = await fetch(`/api/projects/${projectId}/medleys`);
    if (res.ok) {
      const data: Medley[] = await res.json();
      setMedleys(data);
    }
  };

  const loadMedley = async (id: string) => {
    const res = await fetch(`/api/medley/${id}`);
    if (res.ok) {
      const data: Medley = await res.json();
      setSelected(data);
      setTracks(data.tracks ?? []);
      // Compute total
      const dur = (data.tracks ?? []).reduce((s, t) => s + (t.duration_seconds ?? 0), 0);
      setTotalDuration(dur);
    }
  };

  useEffect(() => { loadMedleys(); }, [projectId]);

  const selectMedley = (m: Medley) => {
    setExportResult(null);
    setExportError(null);
    loadMedley(m.id);
  };

  // ── Create medley ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/medley', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: newName.trim() }),
    });
    if (res.ok) {
      const medley: Medley = await res.json();
      setIsCreating(false);
      setNewName('');
      await loadMedleys();
      loadMedley(medley.id);
    }
  };

  // ── Rename medley ───────────────────────────────────────────────────────

  const handleRename = async () => {
    if (!selected || !editNameVal.trim()) return;
    const res = await fetch(`/api/medley/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editNameVal.trim() }),
    });
    if (res.ok) {
      setEditingName(false);
      await loadMedleys();
      await loadMedley(selected.id);
    }
  };

  // ── Delete medley ───────────────────────────────────────────────────────

  const handleDeleteMedley = async (id: string) => {
    setDeletingMedleyId(id);
    const res = await fetch(`/api/medley/${id}`, { method: 'DELETE' });
    setDeletingMedleyId(null);
    if (res.ok) {
      if (selected?.id === id) { setSelected(null); setTracks([]); }
      await loadMedleys();
    }
  };

  // ── Add track ──────────────────────────────────────────────────────────

  const handleAddTrack = async (music: MusicGeneration) => {
    if (!selected) return;
    const res = await fetch(`/api/medley/${selected.id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId: music.id }),
    });
    if (res.ok) await loadMedley(selected.id);
  };

  // ── Remove track ───────────────────────────────────────────────────────

  const handleRemoveTrack = async (trackId: string) => {
    if (!selected) return;
    const res = await fetch(`/api/medley/${selected.id}/tracks/${trackId}`, { method: 'DELETE' });
    if (res.ok) await loadMedley(selected.id);
  };

  // ── Drag to reorder ────────────────────────────────────────────────────

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDropIndex(i); };

  const handleDrop = async (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i || !selected) return;

    const reordered = [...tracks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(i, 0, moved);

    const orders = reordered.map((t, idx) => ({ id: t.id, order: idx }));
    setTracks(reordered);
    setDragIndex(null);
    setDropIndex(null);

    await fetch(`/api/medley/${selected.id}/tracks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
  };

  const handleDragEnd = () => { setDragIndex(null); setDropIndex(null); };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!selected || tracks.length === 0) return;
    setExporting(true);
    setExportResult(null);
    setExportError(null);
    setSavedToMusic(false);
    const res = await fetch(`/api/medley/${selected.id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'mp3', bitrate: 320 }),
    });
    setExporting(false);
    if (res.ok) {
      const data = await res.json();
      setExportResult(data.downloadUrl || data.outputFilePath || 'done');
    } else {
      const err = await res.json().catch(() => ({ error: 'Export failed' }));
      setExportError(err.error || 'Export failed');
    }
  };

  const handleSaveToMusic = async () => {
    if (!selected) return;
    setSavingToMusic(true);
    const res = await fetch(`/api/medley/${selected.id}/save-to-music`, { method: 'POST' });
    setSavingToMusic(false);
    if (res.ok) {
      setSavedToMusic(true);
    } else {
      const err = await res.json().catch(() => ({ error: 'Save failed' }));
      setExportError(err.error || 'Save to Music failed');
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex',
      gap: '16px',
      height: '100%',
      minHeight: '520px',
      fontFamily: 'DM Sans, sans-serif',
    } as React.CSSProperties,

    // Left sidebar
    sidebar: {
      width: '220px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    } as React.CSSProperties,

    sidebarHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '4px',
    } as React.CSSProperties,

    sidebarTitle: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#666',
    } as React.CSSProperties,

    medleyCard: (active: boolean): React.CSSProperties => ({
      padding: '10px 12px',
      borderRadius: '8px',
      background: active ? 'rgba(230,57,70,0.12)' : '#111',
      border: `1px solid ${active ? '#E63946' : '#1E1E1E'}`,
      cursor: 'pointer',
      transition: 'all 120ms ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
    }),

    medleyCardName: {
      fontSize: '13px',
      fontWeight: 500,
      color: '#EBEBEB',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      flex: 1,
    } as React.CSSProperties,

    medleyCardMeta: {
      fontSize: '11px',
      color: '#555',
      flexShrink: 0,
    } as React.CSSProperties,

    deleteBtn: {
      background: 'none',
      border: 'none',
      color: '#444',
      cursor: 'pointer',
      padding: '2px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      transition: 'color 120ms',
    } as React.CSSProperties,

    createBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'transparent',
      border: '1px dashed #2A2A2A',
      color: '#555',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 120ms ease',
      width: '100%',
      textAlign: 'left' as const,
    } as React.CSSProperties,

    nameInput: {
      background: '#0D0D0D',
      border: '1px solid #E63946',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '13px',
      padding: '6px 10px',
      outline: 'none',
      width: '100%',
      fontFamily: 'DM Sans, sans-serif',
    } as React.CSSProperties,

    // Main editor
    editor: {
      flex: 1,
      background: '#0D0D0D',
      borderRadius: '12px',
      border: '1px solid #1A1A1A',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    } as React.CSSProperties,

    editorHeader: {
      padding: '16px 20px',
      borderBottom: '1px solid #1A1A1A',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: '#0A0A0A',
    } as React.CSSProperties,

    iconBadge: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'rgba(230,57,70,0.15)',
      border: '1px solid rgba(230,57,70,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#E63946',
      flexShrink: 0,
    } as React.CSSProperties,

    editorBody: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '20px',
    } as React.CSSProperties,

    sectionLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#444',
      marginBottom: '8px',
    } as React.CSSProperties,

    trackRow: (isDragging: boolean, isDropTarget: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: isDragging ? 'rgba(230,57,70,0.08)' : '#111',
      border: `1px solid ${isDropTarget ? '#E63946' : isDragging ? 'rgba(230,57,70,0.4)' : '#1E1E1E'}`,
      opacity: isDragging ? 0.5 : 1,
      cursor: 'grab',
      transition: 'all 100ms ease',
      userSelect: 'none',
    }),

    grip: {
      color: '#333',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    } as React.CSSProperties,

    trackBadge: {
      padding: '2px 8px',
      borderRadius: '4px',
      background: '#1A1A1A',
      border: '1px solid #2A2A2A',
      fontSize: '11px',
      fontWeight: 600,
      color: '#888',
      fontFamily: 'monospace',
      flexShrink: 0,
    } as React.CSSProperties,

    trackName: {
      flex: 1,
      fontSize: '13px',
      color: '#EBEBEB',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,

    trackDur: {
      fontSize: '11px',
      color: '#555',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    } as React.CSSProperties,

    removeBtn: {
      background: 'none',
      border: 'none',
      color: '#333',
      cursor: 'pointer',
      padding: '3px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      transition: 'color 120ms',
      flexShrink: 0,
    } as React.CSSProperties,

    availableGrid: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '6px',
    } as React.CSSProperties,

    addChip: (disabled: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '6px 10px',
      borderRadius: '6px',
      background: disabled ? '#111' : '#141414',
      border: `1px solid ${disabled ? '#1A1A1A' : '#2A2A2A'}`,
      color: disabled ? '#333' : '#888',
      fontSize: '12px',
      fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all 100ms ease',
    }),

    editorFooter: {
      padding: '14px 20px',
      borderTop: '1px solid #1A1A1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#0A0A0A',
      gap: '12px',
    } as React.CSSProperties,

    durDisplay: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
    } as React.CSSProperties,

    durLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: '#444',
    } as React.CSSProperties,

    durValue: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#EBEBEB',
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '-0.02em',
    } as React.CSSProperties,

    exportBtn: (disabled: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 20px',
      borderRadius: '8px',
      background: disabled ? '#1A1A1A' : '#E63946',
      border: 'none',
      color: disabled ? '#444' : '#fff',
      fontSize: '13px',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 120ms ease',
      letterSpacing: '0.02em',
    }),

    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      gap: '12px',
      color: '#333',
      padding: '40px 20px',
      textAlign: 'center' as const,
    } as React.CSSProperties,

    toast: (ok: boolean): React.CSSProperties => ({
      padding: '8px 14px',
      borderRadius: '6px',
      background: ok ? 'rgba(0,210,106,0.12)' : 'rgba(230,57,70,0.12)',
      border: `1px solid ${ok ? '#00D26A' : '#E63946'}`,
      color: ok ? '#00D26A' : '#E63946',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }),
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>

      {/* ── Left sidebar ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <span style={S.sidebarTitle}>Medleys</span>
          <span style={{ ...S.sidebarTitle, color: '#333' }}>{medleys.length}</span>
        </div>

        {medleys.map(m => (
          <div
            key={m.id}
            style={S.medleyCard(selected?.id === m.id)}
            onClick={() => selectMedley(m)}
            onMouseOver={e => { if (selected?.id !== m.id) (e.currentTarget as HTMLDivElement).style.borderColor = '#333'; }}
            onMouseOut={e => { if (selected?.id !== m.id) (e.currentTarget as HTMLDivElement).style.borderColor = '#1E1E1E'; }}
          >
            <span style={S.medleyCardName}>{m.name}</span>
            <span style={S.medleyCardMeta}>{m.track_count ?? 0}t</span>
            <button
              style={S.deleteBtn}
              onClick={e => { e.stopPropagation(); handleDeleteMedley(m.id); }}
              disabled={deletingMedleyId === m.id}
              title="Delete medley"
              onMouseOver={e => (e.currentTarget.style.color = '#E63946')}
              onMouseOut={e => (e.currentTarget.style.color = '#444')}
            >
              <TrashIcon />
            </button>
          </div>
        ))}

        {isCreating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
              placeholder="Medley name…"
              style={S.nameInput}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                style={{ ...S.exportBtn(!newName.trim()), padding: '6px 12px', fontSize: '12px', flex: 1 }}
              >
                Create
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewName(''); }}
                style={{ padding: '6px 10px', background: 'none', border: '1px solid #222', borderRadius: '6px', color: '#555', cursor: 'pointer', fontSize: '12px' }}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            style={S.createBtn}
            onClick={() => setIsCreating(true)}
            onMouseOver={e => { (e.currentTarget).style.borderColor = '#333'; (e.currentTarget).style.color = '#888'; }}
            onMouseOut={e => { (e.currentTarget).style.borderColor = '#2A2A2A'; (e.currentTarget).style.color = '#555'; }}
          >
            <PlusIcon /> New Medley
          </button>
        )}
      </div>

      {/* ── Main editor ── */}
      <div style={S.editor}>
        {!selected ? (
          <div style={S.emptyState}>
            <div style={{ opacity: 0.15 }}><MixIcon /></div>
            <div style={{ fontSize: '13px', color: '#444' }}>
              {medleys.length === 0 ? 'Create your first medley to combine tracks' : 'Select a medley to edit'}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={S.editorHeader}>
              <div style={S.iconBadge}><MixIcon /></div>
              <div style={{ flex: 1 }}>
                {editingName ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={editNameVal}
                      onChange={e => setEditNameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                      style={{ ...S.nameInput, fontSize: '15px', fontWeight: 600 }}
                    />
                    <button onClick={handleRename} style={{ ...S.exportBtn(false), padding: '6px 12px', fontSize: '12px' }}>
                      <CheckIcon /> Save
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#EBEBEB' }}>{selected.name}</span>
                    <button
                      onClick={() => { setEditNameVal(selected.name); setEditingName(true); }}
                      style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#888')}
                      onMouseOut={e => (e.currentTarget.style.color = '#333')}
                    >
                      <EditIcon />
                    </button>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                  {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)}
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={S.editorBody}>

              {/* Track list */}
              <div>
                <div style={S.sectionLabel}>Track Order</div>
                {tracks.length === 0 ? (
                  <div style={{ padding: '24px', borderRadius: '8px', border: '1px dashed #1E1E1E', textAlign: 'center', color: '#333', fontSize: '12px' }}>
                    Add tracks from your music below
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {tracks.map((track, i) => (
                      <div
                        key={track.id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={e => handleDragOver(e, i)}
                        onDrop={e => handleDrop(e, i)}
                        onDragEnd={handleDragEnd}
                        style={S.trackRow(dragIndex === i, dropIndex === i && dragIndex !== i)}
                      >
                        <span style={S.grip}><GripIcon /></span>
                        <span style={{ ...S.trackBadge, color: '#E63946', borderColor: 'rgba(230,57,70,0.25)', background: 'rgba(230,57,70,0.08)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={S.trackName}>{trackLabel(track, musicList, i)}</span>
                        <span style={S.trackDur}>{formatDuration(track.duration_seconds)}</span>
                        <button
                          style={S.removeBtn}
                          onClick={() => handleRemoveTrack(track.id)}
                          title="Remove track"
                          onMouseOver={e => (e.currentTarget.style.color = '#E63946')}
                          onMouseOut={e => (e.currentTarget.style.color = '#333')}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available tracks */}
              {musicList.length > 0 && (
                <div>
                  <div style={S.sectionLabel}>Add from Project Tracks</div>
                  <div style={S.availableGrid}>
                    {musicList.map(m => {
                      const alreadyAdded = tracks.some(t =>
                        t.source_file_path === m.processed_file_path ||
                        t.source_file_path === m.original_file_path
                      );
                      return (
                        <button
                          key={m.id}
                          style={S.addChip(alreadyAdded)}
                          disabled={alreadyAdded}
                          onClick={() => !alreadyAdded && handleAddTrack(m)}
                          onMouseOver={e => { if (!alreadyAdded) { (e.currentTarget).style.borderColor = '#E63946'; (e.currentTarget).style.color = '#E63946'; } }}
                          onMouseOut={e => { if (!alreadyAdded) { (e.currentTarget).style.borderColor = '#2A2A2A'; (e.currentTarget).style.color = '#888'; } }}
                          title={alreadyAdded ? 'Already in medley' : `Add v${m.version}`}
                        >
                          {alreadyAdded ? <CheckIcon /> : <PlusIcon />}
                          v{m.version}
                          <span style={{ color: '#333', fontSize: '10px' }}>{formatDuration(m.duration_seconds)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Export result / error */}
              {exportResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={S.toast(true)}>
                    <CheckIcon /> Exported ·{' '}
                    <a href={exportResult} download style={{ color: 'inherit', textDecoration: 'underline' }}>Download MP3</a>
                  </div>
                  {savedToMusic ? (
                    <div style={S.toast(true)}>
                      <CheckIcon /> Saved to Music Library — go to Music step to play it
                    </div>
                  ) : (
                    <button
                      onClick={handleSaveToMusic}
                      disabled={savingToMusic}
                      style={{
                        background: '#1E1E1E',
                        border: '1px solid #E63946',
                        color: '#E63946',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: savingToMusic ? 'not-allowed' : 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {savingToMusic ? 'Saving…' : '+ Save to Music Library'}
                    </button>
                  )}
                </div>
              )}
              {exportError && (
                <div style={S.toast(false)}>⚠ {exportError}</div>
              )}

            </div>

            {/* Footer */}
            <div style={S.editorFooter}>
              <div style={S.durDisplay}>
                <span style={S.durLabel}>Total Duration</span>
                <span style={S.durValue}>{formatDuration(totalDuration)}</span>
              </div>
              <button
                style={S.exportBtn(exporting || tracks.length === 0)}
                disabled={exporting || tracks.length === 0}
                onClick={handleExport}
                onMouseOver={e => { if (!exporting && tracks.length > 0) (e.currentTarget).style.background = '#c0303c'; }}
                onMouseOut={e => { if (!exporting && tracks.length > 0) (e.currentTarget).style.background = '#E63946'; }}
              >
                <ExportIcon />
                {exporting ? 'Exporting…' : 'Export Medley'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
