import { C } from '../shared/colors';
import { selectionChanged } from '../../../lib/haptics';

export type MobileSection = 'library' | 'sounds' | 'studio' | 'details' | 'more';

interface Props {
  active: MobileSection;
  onChange: (s: MobileSection) => void;
  hasTrack: boolean;
}

// Clean line icons (liquid-glass friendly — crisp strokes, no emoji glyphs).
function Icon({ id, active }: { id: MobileSection; active: boolean }) {
  const s = active ? C.red : 'rgba(255,255,255,0.5)';
  const p = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: s, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'library': return (<svg {...p}><path d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"/></svg>);
    case 'sounds':  return (<svg {...p}><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>);
    case 'studio':  return (<svg {...p}><path d="M12 2v6M12 16v6M5 12H2M22 12h-3M6.3 6.3L4 4M20 20l-2.3-2.3"/><circle cx="12" cy="12" r="4"/></svg>);
    case 'details': return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>);
    case 'more':    return (<svg {...p}><circle cx="5" cy="12" r="1.6" fill={s} stroke="none"/><circle cx="12" cy="12" r="1.6" fill={s} stroke="none"/><circle cx="19" cy="12" r="1.6" fill={s} stroke="none"/></svg>);
  }
}

const TABS: { id: MobileSection; label: string }[] = [
  { id: 'library', label: 'Home' },
  { id: 'sounds',  label: 'Sounds' },
  { id: 'studio',  label: 'Studio' },
  { id: 'details', label: 'Details' },
  { id: 'more',    label: 'More' },
];

export default function MobileNav({ active, onChange, hasTrack }: Props) {
  return (
    <div style={{
      display: 'flex',
      background: 'rgba(8,2,6,0.6)',
      backdropFilter: 'blur(36px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(36px) saturate(1.8)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const dim = tab.id === 'details' && !hasTrack;
        return (
          <button
            key={tab.id}
            onClick={() => { if (!dim) { selectionChanged(); onChange(tab.id); } }}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: dim ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '9px 4px 7px', gap: '4px', minHeight: '56px',
              opacity: dim ? 0.3 : 1, position: 'relative',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 46, height: 30, borderRadius: 10,
              background: isActive ? 'rgba(230,57,70,0.16)' : 'transparent',
              boxShadow: isActive ? `inset 0 0 0 1px rgba(230,57,70,0.3)` : 'none',
              transition: 'background 200ms, box-shadow 200ms',
            }}>
              <Icon id={tab.id} active={isActive} />
            </div>
            <span style={{ fontSize: '10px', color: isActive ? C.red : 'rgba(255,255,255,0.42)', letterSpacing: '0.01em', fontWeight: isActive ? 600 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
