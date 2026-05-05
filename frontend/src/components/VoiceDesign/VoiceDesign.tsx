import { useState } from 'react';

const VOICE_EXAMPLES = [
  'Deep, gravelly voice like a seasoned jazz vocalist',
  'Energetic and youthful, like a pop radio host',
  'Raspy, emotional indie singer voice',
  'Bold and commanding, authoritative documentary narrator',
  'Soft and intimate, late-night radio host voice',
];

export default function VoiceDesign() {
  const [prompt, setPrompt] = useState('');
  const [previewText, setPreviewText] = useState('Hey everyone, welcome back to the show...');
  const [designing, setDesigning] = useState(false);
  const [voices, setVoices] = useState<Array<{ voiceId: string; trialAudio?: string }>>([]);

  const designVoice = async () => {
    if (!prompt.trim() || !previewText.trim()) return;
    setDesigning(true);
    try {
      const response = await fetch('/api/voice/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, previewText }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert(result.error || 'Voice design failed');
        return;
      }
      setVoices(prev => [result, ...prev]);
    } catch (err) {
      console.error('Voice design failed:', err);
      alert('Network error - please try again');
    } finally {
      setDesigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
          Voice Design Studio
        </h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>
          Create custom AI voices from text descriptions
        </p>
      </div>

      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Try an example prompt
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {VOICE_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex)}
              style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#A0A0A0',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#E63946'}
              onMouseOut={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A'}
            >
              {ex.slice(0, 30)}...
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Voice Description
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the voice: age, gender, accent, personality, speaking style..."
          maxLength={500}
          style={{
            width: '100%',
            height: '80px',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            resize: 'none',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Preview Text
        </label>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Enter preview text..."
          maxLength={500}
          style={{
            width: '100%',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      <button
        onClick={designVoice}
        disabled={designing || !prompt.trim() || !previewText.trim()}
        style={{
          backgroundColor: designing || !prompt.trim() || !previewText.trim() ? '#666666' : '#E63946',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: designing || !prompt.trim() || !previewText.trim() ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
        onMouseOver={(e) => { if (!designing && prompt.trim()) e.currentTarget.style.backgroundColor = '#FF4757'; }}
        onMouseOut={(e) => { if (!designing && prompt.trim()) e.currentTarget.style.backgroundColor = '#E63946'; }}
      >
        {designing ? 'Creating Voice...' : 'Design Voice'}
      </button>

      {voices.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Your Voices</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {voices.map((v, i) => (
              <div key={i} style={{ backgroundColor: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ color: '#E63946', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Voice ID: {v.voiceId}</div>
                <div style={{ color: '#A0A0A0', fontSize: '12px', marginTop: '4px' }}>Ready for TTS synthesis</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}