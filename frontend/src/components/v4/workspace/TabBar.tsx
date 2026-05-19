import { C } from '../shared/colors';
export default function TabBar() {
  return <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 16px' }} data-testid="tab-bar"><span style={{ color: C.textDim, fontSize: '11px', padding: '14px 0' }}>Tabs loading…</span></div>;
}
