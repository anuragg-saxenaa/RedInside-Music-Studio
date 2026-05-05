interface WorkflowStepperProps {
  currentStep: 'lyrics' | 'music' | 'artwork' | 'voice' | 'export';
  onStepChange: (step: 'lyrics' | 'music' | 'artwork' | 'voice' | 'export') => void;
  hasLyrics: boolean;
  hasMusic: boolean;
  hasArtwork?: boolean;
  hasVoice?: boolean;
}

const STEPS = [
  { key: 'lyrics', label: 'Lyrics', icon: '✍️' },
  { key: 'music', label: 'Music', icon: '🎵' },
  { key: 'artwork', label: 'Artwork', icon: '🎨' },
  { key: 'voice', label: 'Voice', icon: '🎤' },
  { key: 'export', label: 'Export', icon: '🔧' },
] as const;

export default function WorkflowStepper({ currentStep, onStepChange, hasLyrics, hasMusic, hasVoice }: WorkflowStepperProps) {
  const getStepState = (step: typeof STEPS[number]['key']) => {
    const stepIndex = STEPS.findIndex(s => s.key === step);
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const canAccessStep = (step: typeof STEPS[number]['key']) => {
    if (step === 'lyrics') return true;
    if (step === 'music') return hasLyrics;
    if (step === 'artwork') return hasMusic;
    if (step === 'voice') return hasMusic;
    if (step === 'export') return hasMusic;
    return false;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
      {STEPS.map((step, index) => {
        const state = getStepState(step.key);
        const canAccess = canAccessStep(step.key);

        const getButtonStyle = () => {
          const base = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '9999px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 500,
            cursor: canAccess ? 'pointer' : 'not-allowed',
            transition: 'all 150ms ease',
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
              <span>{step.icon}</span>
              <span>{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                style={{
                  width: '40px',
                  height: '2px',
                  backgroundColor: state === 'completed' ? '#00D26A' : '#2A2A2A',
                  marginLeft: '8px',
                  marginRight: '8px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}