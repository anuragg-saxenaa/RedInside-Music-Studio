import { useState, useCallback, useEffect } from 'react';
import TrackLane from './TrackLane';
import TimelineView from './TimelineView';
import GridView from './GridView';
import ControlsSidebar, { AudioOperations } from './ControlsSidebar';
import VocalRemovalCard from './VocalRemovalCard';
import { useRealtimeAudio } from '../../hooks/useRealtimeAudio';
import { useSharedAudio } from '../../contexts/SharedAudioContext';

type ViewMode = 'timeline' | 'grid';

export interface AudioEditorPanelProps {
  projectId: string
  audioUrl: string
  trackId: string
  musicId?: string
  mode?: 'single' | 'medley'
  tracks?: any[]
  onExport?: (result: { filePath: string, duration: number }) => void
  presetOperations?: Partial<AudioOperations>
}

const defaultOperations: AudioOperations = {
  trimStart: 0,
  trimEnd: 0,
  speed: 1.0,
  volume: 1.0,
  fadeInEnabled: false,
  fadeInDuration: 1.0,
  fadeOutEnabled: false,
  fadeOutDuration: 1.0,
  reverse: false,
  normalizeEnabled: false,
  normalizeTargetLUFS: -14,
  reverbEnabled: false,
  reverbRoomScale: 50,
  reverbDamping: 50,
  reverbWetLevel: 0.3,
  echoEnabled: false,
  echoDelay: 0.3,
  echoDecay: 0.5,
  bassBoostEnabled: false,
  bassBoostGainDb: 6,
  pitchShiftEnabled: false,
  pitchShiftSemitones: 0,
  vocalRemovalEnabled: false,
  vocalRemovalJobId: null,
  vocalRemovalEngine: null,
  vocalRemovalInstrumentalId: null,
};

export default function AudioEditorPanel({
  audioUrl,
  trackId,
  musicId,
  projectId,
  mode = 'single',
  tracks = [],
  onExport,
  presetOperations,
}: AudioEditorPanelProps) {
  const [duration, setDuration] = useState(0);
  const handleDurationDetected = useCallback((d: number) => {
    setDuration(d);
    setOperations(o => ({ ...o, trimEnd: o.trimEnd > 0 ? o.trimEnd : d }));
  }, []);
  const [operations, setOperations] = useState<AudioOperations>({ ...defaultOperations });

  useEffect(() => {
    if (presetOperations && Object.keys(presetOperations).length > 0) {
      setOperations(o => ({ ...o, ...presetOperations }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(presetOperations)]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error' | 'processing'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { stopAll } = useSharedAudio();

  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const { seek } = useRealtimeAudio({
    audioUrl,
    operations,
    isPlaying,
    onTimeUpdate: handleTimeUpdate,
    onEnded: handleEnded,
    onDurationDetected: handleDurationDetected,
  });

  const handlePlayPause = useCallback(() => {
    if (!isPlaying) stopAll();
    setIsPlaying(p => !p);
  }, [isPlaying, stopAll]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    seek(0);
    setCurrentTime(0);
  }, [seek]);

  const isMedley = mode === 'medley';

  const buildOperationsArray = () => {
    const ops: any[] = [];
    if (operations.trimStart > 0 || operations.trimEnd < duration) {
      ops.push({ type: 'trim', startSec: operations.trimStart, endSec: operations.trimEnd });
    }
    if (operations.speed !== 1.0) ops.push({ type: 'speed', tempoFactor: operations.speed });
    if (operations.volume !== 1.0) ops.push({ type: 'volume', gain: operations.volume });
    if (operations.fadeInEnabled) ops.push({ type: 'fadeIn', durationSec: operations.fadeInDuration });
    if (operations.fadeOutEnabled) ops.push({ type: 'fadeOut', durationSec: operations.fadeOutDuration });
    if (operations.reverse) ops.push({ type: 'reverse' });
    if (operations.normalizeEnabled) ops.push({ type: 'normalize', targetLUFS: operations.normalizeTargetLUFS });
    if (operations.bassBoostEnabled) ops.push({ type: 'bassBoost', gainDb: operations.bassBoostGainDb });
    if (operations.pitchShiftEnabled && operations.pitchShiftSemitones !== 0) ops.push({ type: 'pitchShift', semitones: operations.pitchShiftSemitones });
    if (operations.reverbEnabled) ops.push({ type: 'reverb', roomScale: operations.reverbRoomScale, damping: operations.reverbDamping, wetLevel: operations.reverbWetLevel });
    if (operations.echoEnabled) ops.push({ type: 'echo', delay: operations.echoDelay, decay: operations.echoDecay });
    return ops;
  };

  const handleExport = async (format: 'mp3-320' | 'wav' | 'flac') => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const outputFormat = format === 'mp3-320' ? 'mp3' : format;
      const payload = {
        inputPath: audioUrl,
        operations: buildOperationsArray(),
        options: { format: outputFormat, bitrate: format === 'mp3-320' ? '320k' : undefined },
      };
      setExportMessage({ type: 'processing', text: 'Processing audio...' });
      const response = await fetch('/api/audio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Export failed');

      if (data.downloadUrl) {
        const downloadFilename = data.masteredFile
          ? data.masteredFile.split('/').pop()
          : data.filePath?.split('/').pop();
        if (downloadFilename) {
          const link = document.createElement('a');
          link.href = `/api/audio/download/${downloadFilename}`;
          link.download = downloadFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      setExportMessage({
        type: 'success',
        text: data.masteredFile ? 'Exported & mastered! Download started.' : `Exported! ${data.duration?.toFixed(1) || '?'}s`,
      });
      onExport?.(data);
    } catch (err) {
      setExportMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const effectCount = [
    operations.reverbEnabled, operations.echoEnabled, operations.bassBoostEnabled,
    operations.pitchShiftEnabled, operations.normalizeEnabled, operations.reverse,
    operations.speed !== 1.0, operations.volume !== 1.0,
    operations.fadeInEnabled, operations.fadeOutEnabled,
  ].filter(Boolean).length;

  return (
    <div data-testid="audio-editor-panel" style={{
      background: '#07071a',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Neon Dark header */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E63946', boxShadow: '0 0 8px #E63946' }} />
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}>AUDIO EDITOR</span>

        {effectCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
            background: 'rgba(255,184,0,0.15)', color: '#FFB800',
            border: '1px solid rgba(255,184,0,0.3)', letterSpacing: '0.1em',
          }}>
            {effectCount} EFFECT{effectCount !== 1 ? 'S' : ''}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: '#00D26A', letterSpacing: '0.1em', background: 'rgba(0,210,106,0.1)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(0,210,106,0.2)' }}>
            ● LIVE
          </span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Export message banner */}
      {exportMessage && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 20px', fontSize: 12,
          background: exportMessage.type === 'processing' ? 'rgba(255,184,0,0.12)' : exportMessage.type === 'success' ? 'rgba(0,210,106,0.12)' : 'rgba(230,57,70,0.12)',
          color: exportMessage.type === 'processing' ? '#FFB800' : exportMessage.type === 'success' ? '#00D26A' : '#E63946',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span>{exportMessage.text}</span>
          <button onClick={() => setExportMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
        </div>
      )}

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left: waveform + vocal removal + transport */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Waveform / TrackLane */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {isMedley ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.15em' }}>MEDLEY</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['timeline', 'grid'] as ViewMode[]).map(v => (
                      <button key={v} onClick={() => setViewMode(v)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: viewMode === v ? '#E63946' : 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                        {v === 'timeline' ? '≡' : '⊞'}
                      </button>
                    ))}
                  </div>
                </div>
                {viewMode === 'grid'
                  ? <GridView tracks={tracks} selectedTrackId={trackId} onSelectTrack={() => {}} onReorderTracks={() => {}} onUpdateTrack={() => {}} />
                  : <TimelineView tracks={tracks} selectedTrackId={trackId} onSelectTrack={() => {}} onReorderTracks={() => {}} onUpdateTrack={() => {}} />
                }
              </div>
            ) : (
              <TrackLane
                audioUrl={audioUrl}
                trackId={trackId}
                trimStart={operations.trimStart}
                trimEnd={operations.trimEnd || duration}
                duration={duration}
                currentTime={currentTime}
                isSelected={true}
                isPlaying={isPlaying}
                onSeek={(t) => { setCurrentTime(t); seek(t); }}
                onTrimChange={(s, e) => setOperations(o => ({ ...o, trimStart: s, trimEnd: e }))}
                onPlayPause={handlePlayPause}
              />
            )}
          </div>

          {/* Vocal removal card */}
          {musicId && (
            <div style={{ padding: '12px 16px' }}>
              <VocalRemovalCard
                musicId={musicId}
                projectId={projectId}
                onCompleted={id => setOperations(o => ({
                  ...o,
                  vocalRemovalEnabled: true,
                  vocalRemovalInstrumentalId: id,
                }))}
              />
            </div>
          )}

          {/* Transport bar */}
          <div style={{
            marginTop: 'auto',
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {/* Transport buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleStop} style={transportBtn}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" /></svg>
              </button>
              <button
                onClick={handlePlayPause}
                style={{
                  ...transportBtn,
                  width: 44, height: 44, fontSize: 16,
                  background: isPlaying ? 'linear-gradient(135deg,#E63946,#c0392b)' : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  boxShadow: isPlaying ? '0 0 12px rgba(230,57,70,0.4)' : 'none',
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>

            {/* Progress bar */}
            <div
              style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, cursor: 'pointer' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const t = ((e.clientX - rect.left) / rect.width) * duration;
                seek(t);
                setCurrentTime(t);
              }}
            >
              <div style={{
                height: '100%',
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                background: 'linear-gradient(90deg,#E63946,#FFB800)',
                borderRadius: 2,
                transition: 'width 100ms linear',
                boxShadow: '0 0 4px rgba(230,57,70,0.4)',
              }} />
            </div>

            {/* Effect chips */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {operations.vocalRemovalInstrumentalId && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                  INST
                </span>
              )}
              {effectCount > 0 && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(255,184,0,0.15)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                  {effectCount} FX
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: ControlsSidebar */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <ControlsSidebar
            duration={duration}
            operations={operations}
            onChange={setOperations}
            onPreview={handlePlayPause}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
}

const transportBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
