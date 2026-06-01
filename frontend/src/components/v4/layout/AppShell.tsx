import { type ReactNode, useState, useRef } from 'react';
import { C } from '../shared/colors';
import { useMobile } from '../../../hooks/useMobile';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import MobileNav, { type MobileSection } from '../mobile/MobileNav';
import MobilePlayerFull from '../mobile/MobilePlayerFull';
import PullToRefresh from '../mobile/PullToRefresh';
import OfflineBanner from '../mobile/OfflineBanner';
import { PlayIcon, PauseIcon } from '../shared/Icons';
import { tapLight, tapMedium } from '../../../lib/haptics';

interface AppShellProps {
  titlebar: ReactNode;
  sidebar: ReactNode;
  centre: ReactNode;
  rightPanel: ReactNode;
  playerBar: ReactNode;
  mockBanner?: ReactNode;
}

// Mobile mini player bar
function MobileMiniPlayer({ onExpand }: { onExpand: () => void }) {
  const { playerTrack, playerIsPlaying, playerProgress, togglePlay, playNext, playPrev } = useWorkspace();
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  const artworkUrl = playerTrack?.artwork_url
    ? (playerTrack.artwork_url.startsWith('http') ? playerTrack.artwork_url : `${API_BASE}/api/projects/${playerTrack.project_id}/artwork/${playerTrack.id}`)
    : null;

  // Swipe: up → expand, left/right → skip track
  const start = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const onTouchStart = (e: React.TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false }; setSettling(false); };
  const onTouchMove = (e: React.TouchEvent) => {
    const mx = e.touches[0].clientX - start.current.x;
    const my = e.touches[0].clientY - start.current.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) start.current.moved = true;
    if (Math.abs(mx) > Math.abs(my)) setDx(mx);
    else if (my < -40) { /* upward swipe handled on end */ }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const mx = e.changedTouches[0].clientX - start.current.x;
    const my = e.changedTouches[0].clientY - start.current.y;
    setSettling(true); setDx(0);
    if (Math.abs(mx) > Math.abs(my) && Math.abs(mx) > 60) {
      tapMedium();
      if (mx < 0) playNext(); else playPrev();
    } else if (my < -45) {
      tapLight(); onExpand();
    } else if (!start.current.moved) {
      onExpand();
    }
  };

  return (
    <div
      style={{
        background: 'rgba(26,8,14,0.55)',
        backdropFilter: 'blur(34px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(34px) saturate(1.7)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        margin: '0 8px',
        borderRadius: '16px',
        cursor: 'pointer',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        transform: `translateX(${dx}px)`,
        transition: settling ? 'transform 260ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        touchAction: 'pan-y',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => { if (!start.current.moved) onExpand(); }}
    >
      {/* Progress bar at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', width: `${playerProgress * 100}%`, background: C.red, transition: 'width 0.1s linear' }} />
      </div>

      {/* Artwork */}
      <div style={{
        width: '42px', height: '42px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
        background: `linear-gradient(135deg, ${C.redDark}, #080108)`,
        border: `1px solid ${playerTrack ? C.borderActive : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {artworkUrl ? (
          <img src={artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke={C.red} strokeWidth="1.5" opacity="0.7"/>
            <circle cx="8" cy="8" r="2" fill={C.red} opacity="0.5"/>
          </svg>
        )}
      </div>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {playerTrack ? (playerTrack.title || `Track v${playerTrack.version}`) : 'Nothing playing'}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {playerTrack?.artist || (playerTrack ? 'RedInside Studio' : 'Tap to open player')}
        </div>
      </div>

      {/* Play/Pause button */}
      <button
        onClick={e => { e.stopPropagation(); tapMedium(); togglePlay(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
          width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.text,
        }}
      >
        {playerIsPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </button>
    </div>
  );
}

export default function AppShell({ titlebar, sidebar, centre, rightPanel, playerBar, mockBanner }: AppShellProps) {
  const isMobile = useMobile();
  const { playerTrack, setActiveTab, refreshProjects, refreshTracks } = useWorkspace();
  const [mobileSection, setMobileSection] = useState<MobileSection>('sounds');
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  const handleMobileNav = (section: MobileSection) => {
    setMobileSection(section);
    // Sync activeTab with section
    if (section === 'sounds') setActiveTab('sounds');
    if (section === 'studio') setActiveTab('write');
  };

  /* ── DESKTOP LAYOUT ─────────────────────────────────────────────── */
  if (!isMobile) {
    return (
      <div style={{
        background: C.bgApp, height: '100vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Outfit', 'DM Sans', -apple-system, sans-serif", color: C.text,
      }}>
        {mockBanner}
        {titlebar}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '232px 1fr 268px', overflow: 'hidden', gap: '1px', background: C.border }}>
          <div style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.72)' }} data-testid="left-sidebar">{sidebar}</div>
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(4,1,2,0.92)' }} data-testid="centre-panel">{centre}</div>
          <div style={{ overflow: 'hidden auto', background: 'rgba(0,0,0,0.72)' }} data-testid="right-panel">{rightPanel}</div>
        </div>
        <div style={{ flexShrink: 0, zIndex: 200 }}>{playerBar}</div>
      </div>
    );
  }

  /* ── MOBILE LAYOUT ──────────────────────────────────────────────── */
  return (
    <div style={{
      background: C.bgApp,
      height: '100dvh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Outfit', 'DM Sans', -apple-system, sans-serif",
      color: C.text,
      touchAction: 'manipulation',
    }}>
      {mockBanner}

      {/* Compact mobile titlebar — pad the top by the device safe-area inset so
          the bar clears the status bar / Dynamic Island (native-app feel). */}
      <div style={{ flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)', background: '#000' }}>{titlebar}</div>
      <OfflineBanner />

      {/* Content area — only one panel visible */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Library panel */}
        <div style={{ position: 'absolute', inset: 0, display: mobileSection === 'library' ? 'block' : 'none' }}>
          <PullToRefresh onRefresh={refreshProjects}>{sidebar}</PullToRefresh>
        </div>

        {/* Sounds / Studio — centre workspace (tab bar hides on mobile, nav handles tabs) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: (mobileSection === 'sounds' || mobileSection === 'studio') ? 'flex' : 'none', flexDirection: 'column' }}>
          {centre}
        </div>

        {/* Details — right panel */}
        <div style={{ position: 'absolute', inset: 0, display: mobileSection === 'details' ? 'block' : 'none' }}>
          <PullToRefresh onRefresh={refreshTracks}>{rightPanel}</PullToRefresh>
        </div>

        {/* More panel */}
        {mobileSection === 'more' && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden auto', padding: '24px 20px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '24px' }}>More</div>
            {[
              { label: '⏱  History', href: '#/history' },
              { label: '⚡  Viral Toolkit', href: '#/viral' },
              { label: '⚙  Settings', href: '#/settings' },
            ].map(item => (
              <a key={item.href} href={item.href} style={{
                display: 'block', padding: '16px 0', borderBottom: `1px solid ${C.border}`,
                color: C.text, textDecoration: 'none', fontSize: '16px',
              }}>{item.label}</a>
            ))}
          </div>
        )}
      </div>

      {/* Mini Player */}
      {playerTrack && (
        <MobileMiniPlayer onExpand={() => setShowFullPlayer(true)} />
      )}

      {/* Bottom Nav */}
      <MobileNav
        active={mobileSection}
        onChange={handleMobileNav}
        hasTrack={!!playerTrack}
      />

      {/* Full-screen player overlay */}
      {showFullPlayer && (
        <MobilePlayerFull onClose={() => setShowFullPlayer(false)} />
      )}
    </div>
  );
}
