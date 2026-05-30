import { useState, useRef, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useClerk, useUser } from '@clerk/clerk-react';

export default function Titlebar() {
  const { projects, activeProjectId } = useWorkspace();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Initials from name
  const initials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = user?.fullName || user?.username || 'User';

  return (
    <div
      data-testid="titlebar"
      style={{
        display: 'grid',
        gridTemplateColumns: '232px 1fr 268px',
        alignItems: 'center',
        height: '48px',
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Left — Studio label */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '20px' }}>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>
          Studio
        </span>
      </div>

      {/* Centre — active project breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {activeProject ? (
          <>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px' }}>Project</span>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '11px' }}>›</span>
            <span style={{
              color: C.text,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '-0.1px',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {activeProject.name}
            </span>
          </>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Select a project</span>
        )}
      </div>

      {/* Right — user menu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '16px', position: 'relative' }} ref={menuRef}>
        {/* Custom avatar button */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'rgba(230,57,70,0.15)',
            border: '1px solid rgba(230,57,70,0.3)',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#E63946',
            fontFamily: "'Outfit', sans-serif",
            transition: 'all 150ms ease',
            boxShadow: '0 0 8px rgba(230,57,70,0.15)',
          }}
          title={displayName}
        >
          {isLoaded ? initials(displayName) : '...'}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div style={dropdownStyles.menu}>
            {/* User info */}
            <div style={dropdownStyles.userInfo}>
              <div style={dropdownStyles.avatar}>
                {isLoaded ? initials(displayName) : '...'}
              </div>
              <div>
                <div style={dropdownStyles.userName}>{displayName}</div>
                <div style={dropdownStyles.userEmail}>{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
            </div>

            <div style={dropdownStyles.divider} />

            <a href="#/settings" style={dropdownStyles.menuItem} onClick={() => setMenuOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Settings
            </a>

            <div style={dropdownStyles.divider} />

            <button
              onClick={() => { setMenuOpen(false); signOut(() => { window.location.hash = '#/login'; }); }}
              style={dropdownStyles.signOut}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ris-dropdown-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

const dropdownStyles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: '16px',
    width: '220px',
    background: 'rgba(14, 6, 20, 0.95)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '8px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
    zIndex: 200,
    animation: 'ris-dropdown-in 150ms ease forwards',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 10px 12px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(230,57,70,0.15)',
    border: '1px solid rgba(230,57,70,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: '#E63946',
    fontFamily: "'Outfit', sans-serif",
    flexShrink: 0,
  },
  userName: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
    fontFamily: "'Outfit', sans-serif",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: '1px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
    margin: '4px 0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 10px',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 120ms ease',
    width: '100%',
    border: 'none',
    background: 'none',
  },
  signOut: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 10px',
    borderRadius: '10px',
    color: '#E63946',
    fontSize: '13px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 120ms ease',
    width: '100%',
    border: 'none',
    background: 'none',
  },
};