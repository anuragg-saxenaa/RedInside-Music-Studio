import { C } from '../shared/colors';

export type MobileSection = 'library' | 'sounds' | 'studio' | 'details' | 'more';

interface Props {
  active: MobileSection;
  onChange: (s: MobileSection) => void;
  hasTrack: boolean;
}

const TABS: { id: MobileSection; icon: string; label: string }[] = [
  { id: 'library', icon: '⊞', label: 'Library' },
  { id: 'sounds',  icon: '♪', label: 'Sounds' },
  { id: 'studio',  icon: '✎', label: 'Studio' },
  { id: 'details', icon: '◈', label: 'Details' },
  { id: 'more',    icon: '⋯', label: 'More' },
];

export default function MobileNav({ active, onChange, hasTrack }: Props) {
  return (
    <div style={{
      display: 'flex',
      borderTop: `1px solid ${C.border}`,
      background: 'rgba(6,1,4,0.98)',
      backdropFilter: 'blur(20px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const dim = tab.id === 'details' && !hasTrack;
        return (
          <button
            key={tab.id}
            onClick={() => !dim && onChange(tab.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: dim ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px', gap: '3px', minHeight: '56px',
              opacity: dim ? 0.3 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <span style={{ fontSize: '18px', color: isActive ? C.red : 'rgba(255,255,255,0.45)', lineHeight: 1 }}>
              {tab.icon}
            </span>
            <span style={{ fontSize: '10px', color: isActive ? C.red : 'rgba(255,255,255,0.4)', letterSpacing: '0.02em', fontWeight: isActive ? 600 : 400 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
