interface WorkflowStepperProps {
  currentStep: 'lyrics' | 'music' | 'ffmpeg';
  onStepChange: (step: 'lyrics' | 'music' | 'ffmpeg') => void;
  hasLyrics: boolean;
  hasMusic: boolean;
}

const STEPS = [
  { key: 'lyrics', label: 'Lyrics', icon: '✍️' },
  { key: 'music', label: 'Music', icon: '🎵' },
  { key: 'ffmpeg', label: 'Process', icon: '🔧' },
] as const;

export default function WorkflowStepper({ currentStep, onStepChange, hasLyrics, hasMusic }: WorkflowStepperProps) {
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
    if (step === 'ffmpeg') return hasMusic;
    return false;
  };

  return (
    <div className="flex items-center justify-center gap-4">
      {STEPS.map((step, index) => {
        const state = getStepState(step.key);
        const canAccess = canAccessStep(step.key);

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => canAccess && onStepChange(step.key)}
              disabled={!canAccess}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full
                ${state === 'completed' ? 'bg-green-600' : ''}
                ${state === 'active' ? 'bg-purple-600' : ''}
                ${state === 'pending' ? 'bg-gray-700' : ''}
                ${!canAccess ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
              `}
            >
              <span>{step.icon}</span>
              <span>{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${state === 'completed' ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}