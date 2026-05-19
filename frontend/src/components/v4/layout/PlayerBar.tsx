import { C } from '../shared/colors';
export default function PlayerBar() {
  return <div style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.border}`, padding: '12px 20px', color: C.textDim, fontSize: '12px' }} data-testid="player-bar">No track selected</div>;
}
