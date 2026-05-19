import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { V4Tab } from '../../../types';

const TABS: { id: V4Tab; label: string }[] = [
  { id: 'sounds',  label: 'SOUNDS'  },
  { id: 'write',   label: 'WRITE'   },
  { id: 'create',  label: 'CREATE'  },
  { id: 'craft',   label: 'CRAFT'   },
  { id: 'release', label: 'RELEASE' },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useWorkspace();
  return (
    <div style={{
      display: 'flex', borderBottom: `1px solid ${C.border}`,
      padding: '0 16px', gap: '0', flexShrink: 0,
    }} data-testid="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          data-testid={`tab-${tab.id}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 16px', fontSize: '11px', fontWeight: 700,
            letterSpacing: '1.2px', color: activeTab === tab.id ? C.red : C.textDim,
            borderBottom: `2px solid ${activeTab === tab.id ? C.red : 'transparent'}`,
            marginBottom: '-1px', transition: 'all 150ms',
          }}
          onMouseOver={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
          onMouseOut={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = C.textDim; }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
