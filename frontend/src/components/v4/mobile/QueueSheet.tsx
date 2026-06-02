import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { tapLight } from '../../../lib/haptics';

interface Props { onClose: () => void }

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// "Up Next" — the active play queue. Tap any track to jump to it.
export default function QueueSheet({ onClose }: Props) {
  const { queue, tracks, playerTrack, playQueue } = useWorkspace();
  const q = queue.length ? queue : tracks;
  const curIdx = playerTrack ? q.findIndex(t => t.id === playerTrack.id) : -1;
  const upNext = curIdx >= 0 ? q.slice(curIdx + 1) : q;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', animation: 'ris-fade 200ms ease' }}>
      <style>{`@keyframes ris-fade{from{opacity:0}to{opacity:1}}@keyframes ris-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '72vh', display: 'flex', flexDirection: 'column', background: 'rgba(22,8,12,0.9)', backdropFilter: 'blur(40px) saturate(1.6)', WebkitBackdropFilter: 'blur(40px) saturate(1.6)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px 22px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 10px)', animation: 'ris-sheet 320ms cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}><div style={{ width: 38, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.25)' }} /></div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', textAlign: 'center', padding: '12px 0 10px' }}>Up Next</div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {upNext.length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px', fontSize: 14 }}>Nothing queued.</div>}
          {upNext.map((t) => {
            const art = t.artwork_url ? (t.artwork_url.startsWith('http') ? t.artwork_url : `${API_BASE}/api/projects/${t.project_id}/artwork/${t.id}`) : null;
            const realIdx = q.findIndex(x => x.id === t.id);
            return (
              <button key={t.id} onClick={() => { tapLight(); playQueue(q, realIdx); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 22px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(135deg, ${C.redDark}, #080108)` }}>{art && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t.artist || 'RedInside Studio'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
