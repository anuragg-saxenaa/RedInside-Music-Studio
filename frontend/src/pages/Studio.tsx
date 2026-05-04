import { useState } from 'react';
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

  const handleLyricsGenerated = (lyrics: LyricsGeneration) => {
    setSelectedLyrics(lyrics);
    setCurrentStep('music');
  };

  const handleMusicGenerated = (music: MusicGeneration) => {
    setSelectedMusic(music);
    setCurrentStep('ffmpeg');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white"
        >
          ← Back to Projects
        </button>
        <h2 className="text-xl font-semibold">{project.name}</h2>
      </div>

      <WorkflowStepper
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        hasLyrics={project.current_lyrics_version > 0}
        hasMusic={project.current_music_version > 0}
      />

      <div className="bg-gray-800 rounded-lg p-6">
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
  );
}

function FFmpegPanel({ music }: { music: MusicGeneration }) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ duration: number; bitrate: number } | null>(null);

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
      // Poll for job completion
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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Audio Processing</h3>
      <p className="text-gray-400">Convert audio to 320kbps MP3</p>
      {result ? (
        <div className="bg-green-900/50 p-4 rounded">
          <p className="text-green-400">Processing complete!</p>
          <p>Duration: {result.duration}s | Bitrate: {result.bitrate}kbps</p>
        </div>
      ) : (
        <button
          onClick={processAudio}
          disabled={processing}
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Convert to 320kbps'}
        </button>
      )}
    </div>
  );
}