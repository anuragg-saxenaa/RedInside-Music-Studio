import { useState, useEffect } from 'react';
import type { Project, LyricsGeneration, MusicGeneration } from '../App';
import LyricsEditor from '../components/LyricsEditor/LyricsEditor';
import MusicPlayer from '../components/MusicPlayer/MusicPlayer';
import WorkflowStepper from '../components/WorkflowControl/WorkflowStepper';

interface StudioProps {
  project: Project;
  onBack: () => void;
}

type WorkflowStep = 'lyrics' | 'music' | 'ffmpeg';

export default function Studio({ project, onBack }: StudioProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('lyrics');
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicGeneration | null>(null);

  useEffect(() => {
    if (currentStep === 'ffmpeg' && !selectedMusic && project.current_music_version > 0) {
      fetch(`/api/projects/${project.id}/music`)
        .then(res => res.json())
        .then(musicList => {
          if (musicList.length > 0) {
            setSelectedMusic(musicList[0]);
          }
        })
        .catch(console.error);
    }
  }, [currentStep, project.id, selectedMusic, project.current_music_version]);

  const handleLyricsGenerated = (lyrics: LyricsGeneration) => {
    setSelectedLyrics(lyrics);
    setCurrentStep('music');
  };

  const handleMusicGenerated = (music: MusicGeneration) => {
    setSelectedMusic(music);
    setCurrentStep('ffmpeg');
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontSize: '14px', padding: '8px 12px', borderRadius: '8px' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseOut={(e) => e.currentTarget.style.color = '#A0A0A0'}
          >
            ← Back to Projects
          </button>
          <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{project.name}</h2>
        </div>

        <WorkflowStepper
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          hasLyrics={project.current_lyrics_version > 0}
          hasMusic={project.current_music_version > 0}
        />

        <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', marginTop: '24px', border: '1px solid #2A2A2A' }}>
          {currentStep === 'lyrics' && (
            <LyricsEditor
              projectId={project.id}
              onLyricsGenerated={handleLyricsGenerated}
            />
          )}
          {currentStep === 'music' && (
            <MusicPlayer
              projectId={project.id}
              selectedLyrics={selectedLyrics}
              onMusicGenerated={handleMusicGenerated}
            />
          )}
          {currentStep === 'ffmpeg' && selectedMusic && (
            <FFmpegPanel music={selectedMusic} />
          )}
        </div>
      </div>
    </div>
  );
}

function FFmpegPanel({ music }: { music: MusicGeneration }) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const processAudio = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: music.project_id,
          type: 'ffmpeg-process',
          inputParams: { musicId: music.id },
        }),
      });
      const job = await response.json();
      const poll = async () => {
        const res = await fetch(`/api/jobs/${job.id}`);
        const updatedJob = await res.json();
        if (updatedJob.status === 'completed') {
          setResult(updatedJob.result);
          setProcessing(false);
        } else if (updatedJob.status === 'failed') {
          setProcessing(false);
          alert('Processing failed: ' + updatedJob.error_message);
        } else {
          setTimeout(poll, 1000);
        }
      };
      poll();
    } catch (error) {
      setProcessing(false);
      alert('Failed to start processing');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>Audio Processing</h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>Convert audio to 320kbps MP3</p>
      </div>
      {result ? (
        <div style={{ backgroundColor: '#1E1E1E', padding: '16px', borderRadius: '8px', border: '1px solid #00D26A' }}>
          <p style={{ color: '#00D26A', fontSize: '14px', fontWeight: 500 }}>Processing complete!</p>
          <p style={{ color: '#A0A0A0', fontSize: '13px', marginTop: '8px' }}>Duration: {result.durationSeconds?.toFixed(1)}s | Bitrate: {Math.round(result.bitrate / 1000)}kbps</p>
        </div>
      ) : (
        <button
          onClick={processAudio}
          disabled={processing}
          style={{ backgroundColor: '#E63946', color: '#FFFFFF', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1, alignSelf: 'flex-start' }}
        >
          {processing ? 'Processing...' : 'Convert to 320kbps'}
        </button>
      )}
    </div>
  );
}