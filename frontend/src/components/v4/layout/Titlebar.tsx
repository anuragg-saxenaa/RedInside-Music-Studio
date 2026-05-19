import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function Titlebar() {
  const { projects, activeProjectId } = useWorkspace();
  const activeProject = projects.find(p => p.id === activeProjectId);

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
      {/* Left — empty (brand is in sidebar) */}
      <div />

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

      {/* Right — status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '20px', gap: '6px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: C.red,
          boxShadow: `0 0 6px ${C.red}`,
          opacity: 0.7,
        }} />
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>Live</span>
      </div>
    </div>
  );
}
