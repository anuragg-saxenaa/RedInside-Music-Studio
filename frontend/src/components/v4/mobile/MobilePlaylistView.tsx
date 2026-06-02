import { useEffect, useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import { PlayIcon, PauseIcon, ShuffleIcon } from '../shared/Icons';
import SwipeRow from './SwipeRow';
import DownloadButton from '../downloads/DownloadButton';
import { tapLight, tapMedium } from '../../../lib/haptics';
import type { MusicGeneration } from '../../../types';

interface Props { playlistId: string; onBack: () => void }

function fmtDur(s: number) { const m = Math.floor(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; }

export default function MobilePlaylistView({ playlistId, onBack }: Props) {
  const { playlists, playQueue, removeTrackFromPlaylist, playerTrack, playerIsPlaying, togglePlay, toggleShuffle } = useWorkspace();
  const authFetch = useAuthFetch();
  const [tracks, setTracks] = useState<MusicGeneration[] | null>(null);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  const playlist = playlists.find(p => p.id === playlistId);
  const isLiked = playlist?.name === 'Liked Songs';

  const load = () => {
    authFetch(`/api/playlists/${playlistId}/tracks`).then(r => r.json())
      .then((d: unknown) => setTracks(Array.isArray(d) ? d as MusicGeneration[] : []))
      .catch(() => setTracks([]));
  };
  useEffect(load, [playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = tracks ?? [];
  const totalDur = list.reduce((a, t) => a + (t.duration_seconds ?? 0), 0);
  const meta = (t: MusicGeneration) => ({ id: t.id, title: t.title || `Track v${t.version}`, artist: t.artist, projectId: t.project_id });
  const artFor = (t: MusicGeneration) => t.artwork_url ? (t.artwork_url.startsWith('http') ? t.artwork_url : `${API_BASE}/api/projects/${t.project_id}/artwork/${t.id}`) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1500, background: C.bgApp, display: 'flex', flexDirection: 'column', overflow: 'hidden auto', animation: 'ris-pl-in 300ms cubic-bezier(0.22,1,0.36,1)' }}>
      <style>{`@keyframes ris-pl-in { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      {/* Header with gradient + cover */}
      <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top, 12px) + 8px) 20px 20px', background: `linear-gradient(165deg, ${isLiked ? '#3a0d3f' : '#3a0810'} 0%, ${C.bgApp} 92%)` }}>
        <button onClick={() => { tapLight(); onBack(); }} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 14px' }}>
          <div style={{ width: 150, height: 150, borderRadius: 14, background: isLiked ? 'linear-gradient(135deg,#e0399a,#7a1040)' : `linear-gradient(135deg, ${C.red}, #3a0810)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 50px rgba(0,0,0,0.6)' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="#fff" opacity="0.92">{isLiked ? <path d="M12 21l-1.4-1.3C5.4 15 2 11.9 2 8.2 2 5.4 4.2 3.2 7 3.2c1.6 0 3.1.7 4 1.9 0.9-1.2 2.4-1.9 4-1.9 2.8 0 5 2.2 5 5 0 3.7-3.4 6.8-8.6 11.5L12 21z"/> : <path d="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" stroke="#fff" strokeWidth="0"/>}</svg>
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', textAlign: 'center' }}>{playlist?.name ?? 'Playlist'}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 4 }}>
          {list.length} {list.length === 1 ? 'song' : 'songs'}{totalDur > 0 ? ` · ${fmtDur(totalDur)}` : ''}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <DownloadButton label="Download" tracks={list.map(meta)} />
          <button onClick={() => { tapMedium(); toggleShuffle(); if (list.length) playQueue(list, Math.floor(Math.random() * list.length)); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: 46, height: 46, cursor: 'pointer', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShuffleIcon size={20} />
          </button>
          <button onClick={() => { tapMedium(); if (list.length) playQueue(list, 0); }}
            style={{ background: `radial-gradient(circle at 35% 30%, #ff5663, ${C.red} 70%)`, border: 'none', borderRadius: '50%', width: 58, height: 58, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${C.red}66` }}>
            <span style={{ marginLeft: 3 }}><PlayIcon size={26} /></span>
          </button>
        </div>
      </div>

      {/* Tracks */}
      <div style={{ flex: 1, paddingBottom: 24 }}>
        {tracks === null && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '32px', fontSize: 13 }}>Loading…</div>}
        {tracks && list.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '32px', fontSize: 13 }}>No songs yet — add some with the ♡ or ⋯ menu.</div>}
        {list.map((t, i) => {
          const playing = playerTrack?.id === t.id;
          const art = artFor(t);
          return (
            <SwipeRow key={t.id} onDelete={() => { removeTrackFromPlaylist(playlistId, t.id); setTracks(prev => (prev || []).filter(x => x.id !== t.id)); }}>
              <div
                role="button" tabIndex={0}
                onClick={() => { tapLight(); if (playing) togglePlay(); else playQueue(list, i); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', background: playing ? 'rgba(230,57,70,0.08)' : C.bgApp, cursor: 'pointer' }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: `linear-gradient(135deg, ${C.redDark}, #080108)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {art ? <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={C.red} strokeWidth="1.5" opacity="0.7"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: playing ? C.red : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist || 'RedInside Studio'}</div>
                </div>
                {playing && playerIsPlaying
                  ? <PauseIcon size={16} />
                  : <DownloadButton tracks={[meta(t)]} size={16} />}
              </div>
            </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}
