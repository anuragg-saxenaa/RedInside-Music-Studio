import { C } from '../shared/colors';
export default function Titlebar() {
  return (
    <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }} data-testid="titlebar">
      <span style={{ color: C.red, fontWeight: 700, fontSize: '16px' }}>RedInside <span style={{ color: C.text }}>Studio</span></span>
    </div>
  );
}
