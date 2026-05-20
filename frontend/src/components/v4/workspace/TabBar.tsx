import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { V4Tab } from '../../../types';

const TABS: { id: V4Tab; label: string; icon: string }[] = [
  { id: 'sounds',  label: 'SOUNDS',  icon: '♪' },
  { id: 'write',   label: 'WRITE',   icon: '✎' },
  { id: 'album',   label: 'ALBUM',   icon: '◈' },
  { id: 'craft',   label: 'CRAFT',   icon: '⚙' },
  { id: 'release', label: 'RELEASE', icon: '↗' },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useWorkspace();
  return (
    <div style={{
      display: 'flex',
      borderBottom: `1px solid ${C.border}`,
      padding: '0 24px',
      gap: '0',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.3)',
    }} data-testid="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          data-testid={`tab-${tab.id}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '16px 18px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.4px',
            color: activeTab === tab.id ? C.red : 'rgba(255,255,255,0.35)',
            borderBottom: `2px solid ${activeTab === tab.id ? C.red : 'transparent'}`,
            marginBottom: '-1px',
            transition: 'all 150ms',
          }}
          onMouseOver={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'; }}
          onMouseOut={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <span style={{ marginRight: '6px', opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
