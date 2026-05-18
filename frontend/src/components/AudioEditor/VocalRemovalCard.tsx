import { useState, useEffect } from 'react';

interface VocalRemovalCardProps {
  musicId: string;
  projectId: string;
  onCompleted: (instrumentalMusicId: string) => void;
}

type JobState = 'idle' | 'running' | 'done' | 'error';

export default function VocalRemovalCard({ musicId, projectId, onCompleted }: VocalRemovalCardProps) {
  const [jobState, setJobState] = useState<JobState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [engine, setEngine] = useState<'demucs' | 'ffmpeg' | null>(null);
  const [healthDemucs, setHealthDemucs] = useState<'available' | 'fallback' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setHealthDemucs(d.demucs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.jobId !== jobId) return;
        if (data.event === 'job.progress') {
          setProgress(data.progress);
          setMessage(data.message);
        } else if (data.event === 'job.completed') {
          setJobState('done');
          setEngine(data.result.engine);
          onCompleted(data.result.instrumentalMusicId);
        }
      } catch { /* ignore malformed messages */ }
    };
    const ws = (window as unknown as Record<string, unknown>).__studioWs as WebSocket | undefined;
    ws?.addEventListener('message', handler);
    return () => ws?.removeEventListener('message', handler);
  }, [jobId, onCompleted]);

  const handleStart = async () => {
    setJobState('running');
    setProgress(5);
    setMessage('Queuing job...');
    setError(null);
    try {
      const res = await fetch('/api/audio/remove-vocals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');
      setJobId(data.jobId);
    } catch (e: unknown) {
      setError((e as Error).message);
      setJobState('error');
    }
  };

  const engineBadge = (e: 'demucs' | 'ffmpeg' | null) => ({
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      padding: '2px 8px',
      borderRadius: 20,
      background: e === 'demucs' ? 'rgba(0,210,106,0.15)' : 'rgba(255,184,0,0.15)',
      color: e === 'demucs' ? '#00D26A' : '#FFB800',
      border: `1px solid ${e === 'demucs' ? '#00D26A40' : '#FFB80040'}`,
    },
    label: e === 'demucs' ? 'AI MODEL' : 'FAST MODE',
  });

  return (
    <div style={{
      background: 'rgba(230,57,70,0.07)',
      border: '1px solid rgba(230,57,70,0.25)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#E63946', letterSpacing: '0.1em' }}>
          🎤 VOCAL REMOVAL
        </span>
        {healthDemucs && (
          <span style={engineBadge(healthDemucs === 'available' ? 'demucs' : 'ffmpeg').style}>
            {engineBadge(healthDemucs === 'available' ? 'demucs' : 'ffmpeg').label}
          </span>
        )}
      </div>

      {jobState === 'idle' && (
        <div>
          {healthDemucs === 'fallback' && (
            <div style={{
              background: 'rgba(255,184,0,0.1)',
              border: '1px solid rgba(255,184,0,0.3)',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 10,
              fontSize: 10,
              color: '#FFB800',
              lineHeight: 1.5,
            }}>
              ⚠ Demucs AI not installed — falling back to FFmpeg center-channel subtraction which produces low-quality results.
              For proper vocal separation: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>pip install demucs</code>
            </div>
          )}
          <button
            onClick={handleStart}
            style={{
              background: 'linear-gradient(135deg,#E63946,#c0392b)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              padding: '7px 16px',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(230,57,70,0.3)',
              letterSpacing: '0.05em',
            }}
          >
            Remove Vocals → Instrumental
          </button>
        </div>
      )}

      {jobState === 'running' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{message}</span>
            <span style={{ color: '#E63946', fontSize: 11, fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg,#E63946,#c0392b)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
              boxShadow: '0 0 8px rgba(230,57,70,0.5)',
            }} />
          </div>
        </div>
      )}

      {jobState === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#00D26A', fontSize: 11 }}>✓ Instrumental saved to Music library</span>
          {engine && (
            <span style={engineBadge(engine).style}>{engine === 'demucs' ? 'AI DEMUCS' : 'FFMPEG'}</span>
          )}
        </div>
      )}

      {jobState === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#E63946', fontSize: 11 }}>✗ {error}</span>
          <button
            onClick={() => setJobState('idle')}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'rgba(255,255,255,0.4)', fontSize: 10, padding: '3px 10px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
