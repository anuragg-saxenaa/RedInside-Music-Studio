import { useState, useEffect, useMemo, useCallback } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import type { LyricsGeneration } from '../../../types';

interface Preset { key: string; name: string; description: string; }

const PRESET_FALLBACK: Preset[] = [
  { key: 'hinglish-urban', name: 'Hinglish Urban', description: 'Hindi-English trap/drill' },
  { key: 'hindi-urdu-classical', name: 'Hindi/Urdu Classical', description: 'Ghazal-inspired, poetic' },
  { key: 'punjabi-swagger', name: 'Punjabi Swagger', description: 'Bhangra, Moose Wala energy' },
  { key: 'regional-fusion', name: 'Regional Fusion', description: 'Multi-language fusion' },
  { key: 'custom', name: 'Custom', description: 'Your own direction' },
];

function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupKey(l: LyricsGeneration) {
  return (l.title?.trim() || 'Untitled Draft').toLowerCase();
}

export default function WriteStudio() {
  const { activeProjectId, setSelectedLyrics, setActiveTab } = useWorkspace();
  const authFetch = useAuthFetch();

  const [lyrics, setLyrics] = useState<LyricsGeneration[]>([]);
  const [presets, setPresets] = useState<Preset[]>(PRESET_FALLBACK);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'compose' | 'view'>('compose');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Compose state
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState('hinglish-urban');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View/refine state
  const [refineOpen, setRefineOpen] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refining, setRefining] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadLyrics = useCallback(() => {
    if (!activeProjectId) return;
    authFetch(`/api/projects/${activeProjectId}/lyrics`)
      .then(r => r.json())
      .then((list: LyricsGeneration[]) => setLyrics(Array.isArray(list) ? list : []))
      .catch(() => setLyrics([]));
  }, [activeProjectId, authFetch]);

  useEffect(() => { loadLyrics(); }, [loadLyrics]);

  useEffect(() => {
    authFetch('/api/lyrics/presets').then(r => r.json()).then((data: Record<string, { name: string; description: string }>) => {
      const arr = Object.entries(data).map(([key, v]) => ({ key, name: v.name, description: v.description }));
      if (arr.length) setPresets(arr);
    }).catch(() => {});
  }, [authFetch]);

  const selected = useMemo(() => lyrics.find(l => l.id === selectedId) || null, [lyrics, selectedId]);

  // Group lyrics by title
  const groups = useMemo(() => {
    const filtered = lyrics.filter(l =>
      !search ||
      (l.title || 'Untitled').toLowerCase().includes(search.toLowerCase()) ||
      (l.content || '').toLowerCase().includes(search.toLowerCase())
    );
    const map = new Map<string, LyricsGeneration[]>();
    for (const l of filtered) {
      const k = groupKey(l);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      title: items[0].title?.trim() || 'Untitled Draft',
      items: items.sort((a, b) => b.version - a.version),
      latest: items[0],
    })).sort((a, b) => b.latest.version - a.latest.version);
  }, [lyrics, search]);

  const selectVersion = (l: LyricsGeneration) => {
    setSelectedId(l.id);
    setMode('view');
    setRefineOpen(false);
    setSelectedLyrics(l);
  };

  const startCompose = () => {
    setMode('compose');
    setSelectedId(null);
    setPrompt('');
    setError(null);
  };

  const generate = useCallback(async () => {
    if (!prompt.trim() || !activeProjectId) return;
    setGenerating(true); setError(null);
    try {
      const r = await authFetch('/api/lyrics/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, prompt: prompt.trim(), stylePreset: preset }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Generation failed');
      setLyrics(prev => [data, ...prev]);
      setSelectedLyrics(data);
      selectVersion(data);
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, preset, activeProjectId, authFetch]);

  const refine = useCallback(async () => {
    if (!refinePrompt.trim() || !selected) return;
    setRefining(true); setError(null);
    try {
      const r = await authFetch(`/api/lyrics/edit/${selected.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinePrompt.trim(), stylePreset: selected.style_preset || preset }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Refine failed');
      setLyrics(prev => [data, ...prev]);
      setRefinePrompt(''); setRefineOpen(false);
      setExpandedGroups(prev => new Set(prev).add(groupKey(data)));
      setSelectedLyrics(data);
      selectVersion(data);
    } catch (e) { setError((e as Error).message); }
    finally { setRefining(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refinePrompt, selected, preset, authFetch]);

  const doDelete = useCallback(async (id: string) => {
    try {
      await authFetch(`/api/lyrics/${id}`, { method: 'DELETE' });
      setLyrics(prev => prev.filter(l => l.id !== id));
      setConfirmDelete(null);
      if (selectedId === id) { setSelectedId(null); setMode('compose'); }
    } catch { /* ignore */ }
  }, [authFetch, selectedId]);

  const saveTitle = useCallback(async () => {
    if (!selected || !titleDraft.trim()) { setEditingTitle(false); return; }
    try {
      await authFetch(`/api/lyrics/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      setLyrics(prev => prev.map(l => l.id === selected.id ? { ...l, title: titleDraft.trim() } : l));
    } catch { /* ignore */ }
    setEditingTitle(false);
  }, [selected, titleDraft, authFetch]);

  const toggleGroup = (k: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const useForMusic = () => {
    if (selected) { setSelectedLyrics(selected); setActiveTab('sounds'); }
  };

  return (
    <div data-testid="write-tab" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', height: 'calc(100vh - 200px)', minHeight: '480px' }}>
      {/* ── LEFT RAIL — song library ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        <button
          onClick={startCompose}
          data-testid="new-lyrics-btn"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: mode === 'compose' && !selectedId ? `linear-gradient(135deg, ${C.red}, ${C.redDark})` : `rgba(255,255,255,0.05)`,
            borderColor: mode === 'compose' && !selectedId ? C.borderActive : C.border,
            borderWidth: '1px', borderStyle: 'solid',
            color: C.text, fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px',
            transition: 'all 200ms',
          }}
        >
          <span style={{ fontSize: '16px' }}>✎</span> New Lyrics
        </button>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search lyrics…"
          style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '8px 12px', color: C.text, fontSize: '12px', outline: 'none',
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
          {groups.length === 0 && (
            <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', padding: '32px 12px', lineHeight: 1.6 }}>
              {lyrics.length === 0 ? 'No lyrics yet.\nWrite your first one →' : 'No matches'}
            </div>
          )}
          {groups.map(g => {
            const expanded = expandedGroups.has(g.key);
            const isSelGroup = selected && groupKey(selected) === g.key;
            return (
              <div key={g.key} style={{
                borderRadius: '10px', overflow: 'hidden',
                border: `1px solid ${isSelGroup ? C.borderActive : C.border}`,
                background: isSelGroup ? C.glassActive : 'rgba(255,255,255,0.025)',
              }}>
                {/* Group header */}
                <div
                  onClick={() => { g.items.length > 1 ? toggleGroup(g.key) : selectVersion(g.latest); }}
                  style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {g.items.length > 1 && (
                      <span style={{ color: C.textDim, fontSize: '10px', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>▶</span>
                    )}
                    <span style={{ flex: 1, color: C.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.title}
                    </span>
                    <span style={{ color: C.textDim, fontSize: '10px', flexShrink: 0 }}>{relTime(g.latest.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.4px', color: C.red, background: `${C.red}1a`, padding: '2px 7px', borderRadius: '20px', textTransform: 'uppercase' }}>
                      {(g.latest.style_preset || 'custom').replace(/-/g, ' ')}
                    </span>
                    {g.items.length > 1 && (
                      <span style={{ fontSize: '10px', color: C.textDim }}>{g.items.length} versions</span>
                    )}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', lineHeight: 1.4, maxHeight: '30px', overflow: 'hidden' }}>
                    {(g.latest.content || '').replace(/\[[^\]]*\]/g, '').trim().slice(0, 70)}…
                  </div>
                </div>

                {/* Version pills */}
                {expanded && g.items.length > 1 && (
                  <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {g.items.map(v => (
                      <button key={v.id} onClick={() => selectVersion(v)} style={{
                        fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', cursor: 'pointer',
                        border: `1px solid ${selectedId === v.id ? C.borderActive : C.border}`,
                        background: selectedId === v.id ? `${C.red}22` : 'rgba(255,255,255,0.04)',
                        color: selectedId === v.id ? C.red : 'rgba(255,255,255,0.5)',
                      }}>v{v.version}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANE ───────────────────────────────────────────── */}
      <div style={{ minHeight: 0, overflowY: 'auto', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.25)' }}>
        {mode === 'compose' || !selected ? (
          /* COMPOSE */
          <div style={{ padding: '32px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, marginBottom: '4px', letterSpacing: '-0.3px' }}>Write Lyrics</div>
              <div style={{ fontSize: '13px', color: C.textDim }}>Describe your song. AI writes full lyrics in your chosen style.</div>
            </div>

            {/* Style presets */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', color: C.textDim, marginBottom: '8px', textTransform: 'uppercase' }}>Style</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {presets.map(p => (
                  <button key={p.key} onClick={() => setPreset(p.key)} title={p.description} style={{
                    padding: '8px 14px', borderRadius: '22px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${preset === p.key ? C.borderActive : C.border}`,
                    background: preset === p.key ? `${C.red}1a` : 'rgba(255,255,255,0.03)',
                    color: preset === p.key ? C.red : 'rgba(255,255,255,0.6)',
                    transition: 'all 150ms',
                  }}>{p.name}</button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', color: C.textDim, marginBottom: '8px', textTransform: 'uppercase' }}>Concept</div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. A late-night drive through the city, chasing dreams, bittersweet nostalgia, references to old friends and new ambitions…"
                style={{
                  width: '100%', height: '130px', background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.border}`,
                  borderRadius: '12px', padding: '14px 16px', color: C.text, fontSize: '14px', lineHeight: 1.6,
                  resize: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.borderActive)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)}
              />
            </div>

            {error && <div style={{ color: '#ff6b6b', fontSize: '13px', padding: '10px 14px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px' }}>{error}</div>}

            <button
              onClick={generate}
              disabled={!prompt.trim() || generating}
              data-testid="generate-lyrics-btn"
              style={{
                padding: '15px', borderRadius: '12px', border: 'none',
                background: (!prompt.trim() || generating) ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${C.red}, ${C.redDark})`,
                color: (!prompt.trim() || generating) ? 'rgba(255,255,255,0.4)' : '#fff',
                fontSize: '15px', fontWeight: 700, cursor: (!prompt.trim() || generating) ? 'default' : 'pointer',
                boxShadow: (!prompt.trim() || generating) ? 'none' : `0 6px 24px ${C.red}44`,
                transition: 'all 200ms', letterSpacing: '0.2px',
              }}
            >
              {generating ? '✍️  Writing lyrics…' : '✦  Generate Lyrics'}
            </button>
          </div>
        ) : (
          /* VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingTitle ? (
                    <input
                      autoFocus value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                      onBlur={saveTitle}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.borderActive}`, borderRadius: '8px', padding: '6px 10px', color: C.text, fontSize: '20px', fontWeight: 700, outline: 'none' }}
                    />
                  ) : (
                    <div
                      onClick={() => { setTitleDraft(selected.title || ''); setEditingTitle(true); }}
                      style={{ fontSize: '20px', fontWeight: 700, color: C.text, cursor: 'text', letterSpacing: '-0.2px' }}
                      title="Click to rename"
                    >
                      {selected.title || 'Untitled Draft'} <span style={{ fontSize: '12px', color: C.textDim, fontWeight: 400 }}>✎</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.4px', color: C.red, background: `${C.red}1a`, padding: '3px 9px', borderRadius: '20px', textTransform: 'uppercase' }}>
                      {(selected.style_preset || 'custom').replace(/-/g, ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: C.textDim }}>v{selected.version} · {relTime(selected.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Action toolbar */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={useForMusic} data-testid="use-for-music-btn" style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.red}, ${C.redDark})`, color: '#fff', fontSize: '12px', fontWeight: 700,
                  boxShadow: `0 3px 14px ${C.red}33`,
                }}>⚡ Use for Music</button>
                <button onClick={() => setRefineOpen(v => !v)} style={{
                  padding: '9px 14px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${refineOpen ? C.borderActive : C.border}`, background: refineOpen ? C.glassActive : 'rgba(255,255,255,0.04)', color: C.text,
                }}>✨ Refine</button>
                <button onClick={() => { navigator.clipboard.writeText(selected.content || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{
                  padding: '9px 14px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text,
                }}>{copied ? '✓ Copied' : '⧉ Copy'}</button>
                {confirmDelete === selected.id ? (
                  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button onClick={() => doDelete(selected.id)} style={{ padding: '9px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: C.red, color: '#fff' }}>Delete?</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', border: `1px solid ${C.border}`, background: 'none', color: C.textDim }}>✕</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(selected.id)} style={{
                    padding: '9px 14px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    border: `1px solid rgba(255,107,107,0.3)`, background: 'rgba(255,107,107,0.06)', color: '#ff6b6b', marginLeft: 'auto',
                  }}>🗑 Delete</button>
                )}
              </div>

              {/* Refine box */}
              {refineOpen && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') refine(); }}
                    placeholder="How should I change it? e.g. 'make the chorus catchier, add a bridge'"
                    autoFocus
                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.borderActive}`, borderRadius: '9px', padding: '10px 14px', color: C.text, fontSize: '13px', outline: 'none' }}
                  />
                  <button onClick={refine} disabled={!refinePrompt.trim() || refining} style={{
                    padding: '10px 18px', borderRadius: '9px', border: 'none', cursor: refining ? 'default' : 'pointer', fontSize: '13px', fontWeight: 700,
                    background: (!refinePrompt.trim() || refining) ? 'rgba(255,255,255,0.07)' : C.red, color: '#fff', whiteSpace: 'nowrap',
                  }}>{refining ? 'Refining…' : 'Apply'}</button>
                </div>
              )}
              {error && <div style={{ color: '#ff6b6b', fontSize: '12px' }}>{error}</div>}
            </div>

            {/* Lyrics content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <pre style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                fontFamily: "'DM Sans', sans-serif", fontSize: '15px', lineHeight: 1.85, color: 'rgba(255,255,255,0.88)',
              }}>
                {(selected.content || '').split('\n').map((line, i) => {
                  const isTag = /^\[.*\]$/.test(line.trim());
                  return (
                    <div key={i} style={isTag
                      ? { color: C.red, fontWeight: 700, fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '16px 0 6px' }
                      : undefined}>
                      {line || ' '}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
