import { useState, useEffect } from 'react';
import type { Project, LyricsGeneration, MusicGeneration } from '../types';
import LyricsEditor from '../components/LyricsEditor/LyricsEditor';
import MusicPlayer from '../components/MusicPlayer/MusicPlayer';
import ArtworkGenerator from '../components/ArtworkGenerator/ArtworkGenerator';
import VideoPreview from '../components/VideoPreview/VideoPreview';
import VoiceDesign from '../components/VoiceDesign/VoiceDesign';
import WorkflowStepper from '../components/WorkflowControl/WorkflowStepper';
import CompactPlayer from '../components/MusicPlayer/CompactPlayer';
import AudioMasteringPanel from '../components/Mastering/AudioMasteringPanel';
import MedleyPanel from '../components/Medley/MedleyPanel';

interface StudioProps {
  project: Project;
  onBack: () => void;
}

type WorkflowStep = 'lyrics' | 'music' | 'artwork' | 'video' | 'voice' | 'medley' | 'export';

export default function Studio({ project, onBack }: StudioProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('lyrics');
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicGeneration | null>(null);
  const [activePlayerMusic, setActivePlayerMusic] = useState<MusicGeneration | null>(null);
  const [allMusicList, setAllMusicList] = useState<MusicGeneration[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  // Track generation state locally — project prop is stale after first load
  const [hasLyrics, setHasLyrics] = useState(project.current_lyrics_version > 0);
  const [hasMusic, setHasMusic] = useState(project.current_music_version > 0);

  useEffect(() => {
    if (hasMusic || project.current_music_version > 0) {
      fetchMusicList();
    }
    // Pre-load latest lyrics so Music step works without re-selecting lyrics
    if (project.current_lyrics_version > 0) {
      fetch(`/api/projects/${project.id}/lyrics`)
        .then(res => res.json())
        .then(list => { if (Array.isArray(list) && list.length > 0) setSelectedLyrics(list[0]); })
        .catch(() => {});
    }
    // Load existing artwork if project has music (no artwork without music)
    if (project.current_music_version > 0) {
      fetch(`/api/projects/${project.id}/artwork`)
        .then(res => (res.ok && res.status !== 204) ? res.blob() : null)
        .then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setArtworkUrl(url);
          }
        })
        .catch(() => {});
    }
  }, [project.id, project.current_music_version, refreshKey]);

  const fetchMusicList = () => {
    fetch(`/api/projects/${project.id}/music`)
      .then(res => res.json())
      .then(musicList => {
        setAllMusicList(musicList);
        // Auto-select first track for video/export whenever selectedMusic is unset
        if (!selectedMusic && musicList.length > 0) {
          setSelectedMusic(musicList[0]);
        }
      })
      .catch(console.error);
  };

  const handleLyricsGenerated = (lyrics: LyricsGeneration) => {
    setSelectedLyrics(lyrics);
    setHasLyrics(true);
  };

  const handleMusicGenerated = (music: MusicGeneration) => {
    setSelectedMusic(music);
    setActivePlayerMusic(music);
    setHasMusic(true);
    setCurrentStep('artwork');
    setArtworkUrl(null);
    fetchMusicList();
  };

  // Fetch per-music artwork when entering artwork step
  useEffect(() => {
    if (currentStep === 'artwork' && selectedMusic) {
      fetch(`/api/projects/${project.id}/artwork/${selectedMusic.id}`)
        .then(res => (res.ok && res.status !== 204) ? res.blob() : null)
        .then(blob => {
          if (blob) {
            setArtworkUrl(URL.createObjectURL(blob));
          }
        })
        .catch(() => {});
    }
  }, [currentStep, selectedMusic?.id]);

  const handleSelectForPlayer = (music: MusicGeneration) => {
    setActivePlayerMusic(music);
  };

  const handleConversionComplete = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', padding: '24px', fontFamily: 'DM Sans, sans-serif', paddingBottom: (activePlayerMusic && currentStep !== 'music') ? '140px' : '80px' }}>
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
          hasLyrics={hasLyrics}
          hasMusic={hasMusic}
        />

        <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', marginTop: '24px', border: '1px solid #2A2A2A', minHeight: '400px' }}>
          <div style={{ display: currentStep === 'lyrics' ? 'block' : 'none' }}>
            <LyricsEditor
              projectId={project.id}
              onLyricsGenerated={handleLyricsGenerated}
            />
          </div>
          <div style={{ display: currentStep === 'music' ? 'block' : 'none' }}>
            <MusicPlayer
              projectId={project.id}
              selectedLyrics={selectedLyrics}
              onMusicGenerated={handleMusicGenerated}
              onSelectForPlayer={handleSelectForPlayer}
              allMusic={allMusicList}
              onConversionComplete={handleConversionComplete}
            />
          </div>
          <div style={{ display: currentStep === 'artwork' ? 'block' : 'none' }}>
            <ArtworkGenerator
              projectId={project.id}
              musicId={selectedMusic?.id}
              onSelectArtwork={setArtworkUrl}
            />
          </div>
          <div style={{ display: currentStep === 'video' ? 'block' : 'none' }}>
            <VideoPreview
              projectId={project.id}
              selectedMusic={selectedMusic}
            />
          </div>
          <div style={{ display: currentStep === 'voice' ? 'block' : 'none' }}>
            <VoiceDesign projectId={project.id} />
          </div>
          <div style={{ display: currentStep === 'medley' ? 'block' : 'none' }}>
            <MedleyPanel
              projectId={project.id}
              musicList={allMusicList}
            />
          </div>
          <div style={{ display: currentStep === 'export' ? 'block' : 'none' }}>
            <AudioMasteringPanel
              projectId={project.id}
              allMusic={allMusicList}
            />
          </div>
        </div>
      </div>

      {/* Persistent Player Bar - hidden on Music step (MusicPlayer has its own PlaybackBar) */}
      {activePlayerMusic && currentStep !== 'music' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#141414',
          borderTop: '1px solid #2A2A2A',
          padding: '12px 24px',
          zIndex: 1000,
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <CompactPlayer
              musicId={activePlayerMusic.id}
              version={activePlayerMusic.version}
              durationMs={(activePlayerMusic.duration_seconds || 0) * 1000}
              audioUrl={`/api/music/${activePlayerMusic.id}/file`}
              title={activePlayerMusic.title || `Version ${activePlayerMusic.version}`}
              model={activePlayerMusic.model}
              artworkUrl={artworkUrl || undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}

