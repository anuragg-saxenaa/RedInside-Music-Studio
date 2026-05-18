interface WorkflowStepperProps {
  currentStep: 'lyrics' | 'music' | 'artwork' | 'video' | 'voice' | 'medley' | 'export';
  onStepChange: (step: 'lyrics' | 'music' | 'artwork' | 'video' | 'voice' | 'medley' | 'export') => void;
  hasLyrics: boolean;
  hasMusic: boolean;
  hasArtwork?: boolean;
}

const STEPS = [
  { key: 'lyrics', label: 'Lyrics' },
  { key: 'music', label: 'Music' },
  { key: 'artwork', label: 'Artwork' },
  { key: 'video', label: 'Video' },
  { key: 'voice', label: 'Voice' },
  { key: 'medley', label: 'Medley' },
  { key: 'export', label: 'Export' },
] as const;

export default function WorkflowStepper({ currentStep, onStepChange, hasLyrics: _hasLyrics, hasMusic: _hasMusic }: WorkflowStepperProps) {
  const getStepState = (step: typeof STEPS[number]['key']) => {
    const stepIndex = STEPS.findIndex(s => s.key === step);
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const canAccessStep = (_step: typeof STEPS[number]['key']) => {
    return true;
  };

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', minWidth: 'max-content', padding: '4px 8px' }}>
      {STEPS.map((step, index) => {
        const state = getStepState(step.key);
        const canAccess = canAccessStep(step.key);

        const getButtonStyle = () => {
          const base = {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '9999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 500,
            cursor: canAccess ? 'pointer' : 'not-allowed',
            transition: 'all 150ms ease',
            whiteSpace: 'nowrap' as const,
          };

          if (state === 'completed') {
            return { ...base, backgroundColor: '#1E1E1E', color: '#00D26A', border: '1px solid #00D26A' };
          }
          if (state === 'active') {
            return { ...base, backgroundColor: '#E63946', color: '#FFFFFF' };
          }
          return { ...base, backgroundColor: '#1E1E1E', color: canAccess ? '#A0A0A0' : '#666666', border: '1px solid #2A2A2A' };
        };

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              data-testid={`step-${step.key}`}
              onClick={() => canAccess && onStepChange(step.key)}
              disabled={!canAccess}
              style={getButtonStyle()}
              onMouseOver={(e) => {
                if (canAccess && state !== 'active') {
                  e.currentTarget.style.borderColor = '#E63946';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseOut={(e) => {
                if (canAccess && state !== 'active') {
                  e.currentTarget.style.borderColor = '#2A2A2A';
                  e.currentTarget.style.color = '#A0A0A0';
                }
              }}
            >
              <span>{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                style={{
                  width: '20px',
                  height: '2px',
                  backgroundColor: state === 'completed' ? '#00D26A' : '#2A2A2A',
                  marginLeft: '4px',
                  marginRight: '4px',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}