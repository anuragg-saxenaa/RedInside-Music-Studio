import { C } from '../shared/colors';

export default function Titlebar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      borderBottom: `1px solid ${C.border}`,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }} data-testid="titlebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke={C.red} strokeWidth="2"/>
          <path d="M10 8L20 14L10 20V8Z" fill={C.red}/>
        </svg>
        <span style={{ color: C.red, fontWeight: 700, fontSize: '16px', fontFamily: "'SF Pro Display', Inter, sans-serif", letterSpacing: '-0.3px' }}>
          RedInside <span style={{ color: C.text }}>Studio</span>
        </span>
      </div>
    </div>
  );
}
