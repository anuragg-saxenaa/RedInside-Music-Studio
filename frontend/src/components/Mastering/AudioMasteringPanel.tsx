import { useState, useEffect } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';
import AudioEditorPanel from '../AudioEditor/AudioEditorPanel';

interface FileInfo {
  id: string;
  filename: string;
  status: 'uploading' | 'idle' | 'processing' | 'mastering' | 'complete' | 'error';
  progress: number;
  duration?: number;
  bitrate?: string;
  error?: string;
  filePath?: string;
  selected?: boolean;
  musicId?: string;
}

interface AudioMasteringPanelProps {
  projectId: string;
  allMusic: any[];
}

export default function AudioMasteringPanel({ projectId, allMusic }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [vuLevel, setVuLevel] = useState(0);
  const [editingFile, setEditingFile] = useState<FileInfo | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!allMusic || allMusic.length === 0) return;
    setFiles(prev => {
      const existingMusicIds = new Set(prev.filter(f => f.musicId).map(f => f.musicId));
      const newTracks: FileInfo[] = allMusic
        .filter((m: any) => !existingMusicIds.has(m.id))
        .map((m: any) => ({
          id: m.id,
          filename: m.title || `Version ${m.version}`,
          status: 'idle' as const,
          progress: 0,
          duration: m.duration_seconds,
          musicId: m.id,
        }));
      const uploadedFiles = prev.filter(f => !f.musicId);
      return [...newTracks, ...uploadedFiles];
    });
  }, [allMusic]);

  const handleUploadComplete = (uploadedFiles: Array<{ id: string; filename: string; originalPath?: string }>) => {
    setFiles(prev => [...prev, ...uploadedFiles.map(f => ({ id: f.id, filename: f.filename, status: 'idle' as const, progress: 0, filePath: f.originalPath }))]);
  };

  const masterFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing', progress: 5 } : f));

    const vuInterval = setInterval(() => {
      setVuLevel(prev => {
        const noise = Math.random() * 20;
        return Math.min(85, prev + noise);
      });
    }, 150);

    try {
      const body = file.musicId
        ? { musicId: file.musicId, projectId, preset: 'spotify' }
        : { fileId, projectId, preset: 'spotify', saveToProject: true };
      const response = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      clearInterval(vuInterval);
      setVuLevel(100);

      if (response.ok) {
        await response.json();
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete', progress: 100 } : f));
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Processing failed');
      }
    } catch (err: any) {
      clearInterval(vuInterval);
      setVuLevel(0);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error', error: err.message } : f));
    }
  };

  const masterSelected = async () => {
    const selectedIdle = files.filter(f => f.selected && (f.status === 'idle' || f.status === 'error'));
    for (const file of selectedIdle) {
      await masterFile(file.id);
    }
  };

  const masterAll = async () => {
    const idleFiles = files.filter(f => f.status === 'idle' || f.status === 'error');
    for (const file of idleFiles) {
      await masterFile(file.id);
    }
  };

  const toggleSelection = (index: number, shiftKey: boolean = false) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          newFiles[i] = { ...newFiles[i], selected: true };
        }
      } else {
        newFiles[index] = { ...newFiles[index], selected: !newFiles[index].selected };
      }
      return newFiles;
    });
    setLastSelectedIndex(index);
  };

  const selectAll = () => {
    setFiles(prev => prev.map(f => ({ ...f, selected: true })));
  };

  const clearSelection = () => {
    setFiles(prev => prev.map(f => ({ ...f, selected: false })));
    setLastSelectedIndex(null);
  };

  const saveToMusic = async () => {
    const selectedFiles = files.filter(f => f.selected && f.status === 'complete');
    if (selectedFiles.length === 0) return;

    try {
      const response = await fetch('/api/mastering/save-to-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileIds: selectedFiles.map(f => f.id)
        })
      });

      if (!response.ok) throw new Error('Save failed');

      const { saved } = await response.json();
      alert(`Saved ${saved.length} mastered files to Music`);
    } catch (error) {
      console.error('Save to music failed:', error);
      alert('Failed to save to Music');
    }
  };

  const downloadZip = async () => {
    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length === 0) return;

    const fileIds = selectedFiles.map(f => f.id).join(',');
    const url = `/api/mastering/zip?projectId=${projectId}&fileIds=${fileIds}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `mastered-tracks-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('ZIP download failed:', error);
    }
  };

  const handleEditFile = (file: FileInfo) => {
    setEditingFile(file);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const selectedCount = files.filter(f => f.selected).length;
  const masteredCount = files.filter(f => f.status === 'complete').length;
  const hasMasteredSelected = files.some(f => f.selected && f.status === 'complete');

  const getStatusTag = (status: FileInfo['status']) => {
    switch (status) {
      case 'complete': return { label: 'Mastered', class: 'tag-complete' };
      case 'processing': return { label: 'Mastering', class: 'tag-mastering' };
      case 'error': return { label: 'Error', class: 'tag-error' };
      default: return { label: 'Pending', class: 'tag-pending' };
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // If editing a file, show AudioEditorPanel instead
  if (editingFile) {
    const audioUrl = `/api/mastering/${editingFile.id}/file/${projectId}`;
    return (
      <div style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
        borderRadius: '16px',
        border: '1px solid #3a3a3a',
        padding: '20px',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setEditingFile(null)}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: '6px',
              padding: '8px 16px',
              color: '#888',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Back to Mastering
          </button>
        </div>
        <AudioEditorPanel
          projectId={projectId}
          audioUrl={audioUrl}
          trackId={editingFile.id}
          onExport={() => setEditingFile(null)}
        />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .mastering-panel {
          background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 40%, #0d0d18 100%);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
        }
        .mastering-panel .glass-toolbar {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.03);
        }
        .mastering-panel .toolbar-title {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .mastering-panel .toolbar-hint {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          margin-left: auto;
        }
        .mastering-panel .file-list-container {
          max-height: 400px;
          overflow-y: auto;
          padding: 12px 16px;
        }
        .mastering-panel .file-list-container::-webkit-scrollbar {
          width: 8px;
        }
        .mastering-panel .file-list-container::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
        }
        .mastering-panel .file-list-container::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 4px;
        }
        .mastering-panel .glass-row {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          margin-bottom: 8px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          transition: all 300ms ease;
        }
        .mastering-panel .glass-row:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-1px);
        }
        .mastering-panel .glass-row.selected {
          background: rgba(230,57,70,0.12);
          border: 1px solid rgba(230,57,70,0.35);
          box-shadow: 0 8px 32px rgba(230,57,70,0.1);
        }
        .mastering-panel .icon-circle {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          flex-shrink: 0;
          transition: all 300ms;
        }
        .mastering-panel .glass-row.selected .icon-circle {
          background: rgba(230,57,70,0.25);
          color: #E63946;
        }
        .mastering-panel .file-info {
          flex: 1;
          min-width: 0;
        }
        .mastering-panel .file-name {
          font-size: 14px;
          color: rgba(255,255,255,0.85);
          font-weight: 500;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mastering-panel .glass-row.selected .file-name {
          color: #fff;
        }
        .mastering-panel .file-meta {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .mastering-panel .meta-val {
          font-variant-numeric: tabular-nums;
        }
        .mastering-panel .tag {
          font-size: 10px;
          padding: 4px 10px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        .mastering-panel .tag-complete {
          background: rgba(0,255,136,0.12);
          color: #00FF88;
        }
        .mastering-panel .tag-mastering {
          background: rgba(255,180,0,0.12);
          color: #FFB800;
        }
        .mastering-panel .tag-error {
          background: rgba(230,57,70,0.12);
          color: #E63946;
        }
        .mastering-panel .tag-pending {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.4);
        }
        .mastering-panel .waveform {
          display: flex;
          align-items: center;
          gap: 2px;
          width: 56px;
          flex-shrink: 0;
        }
        .mastering-panel .wave-bar {
          width: 3px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }
        .mastering-panel .glass-row.selected .wave-bar {
          background: rgba(230,57,70,0.3);
        }
        .mastering-panel .check-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: transparent;
          font-size: 11px;
          flex-shrink: 0;
          transition: all 200ms;
        }
        .mastering-panel .glass-row.selected .check-circle {
          background: #E63946;
          border-color: #E63946;
          color: white;
        }
        .mastering-panel .action-bar {
          padding: 18px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.03);
        }
        .mastering-panel .btn {
          padding: 12px 24px;
          border-radius: 14px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 200ms;
        }
        .mastering-panel .btn-primary {
          background: linear-gradient(135deg, #E63946, #B8232E);
          color: white;
          box-shadow: 0 6px 24px rgba(230,57,70,0.3);
        }
        .mastering-panel .btn-primary:hover {
          box-shadow: 0 8px 32px rgba(230,57,70,0.4);
          transform: translateY(-1px);
        }
        .mastering-panel .btn-primary:disabled {
          opacity: 0.4;
          transform: none;
          box-shadow: none;
          cursor: not-allowed;
        }
        .mastering-panel .btn-ghost {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
        }
        .mastering-panel .btn-ghost:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
        }
        .mastering-panel .spacer {
          flex: 1;
        }
        .mastering-panel .stat {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
        }
        .mastering-panel .stat strong {
          color: #E63946;
        }
        .mastering-panel .upload-section {
          padding: 16px 20px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mastering-panel .upload-label {
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .mastering-panel .edit-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.4);
          font-size: 14px;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 200ms;
        }
        .mastering-panel .glass-row:hover .edit-btn {
          display: flex;
        }
        .mastering-panel .edit-btn:hover {
          background: rgba(230,57,70,0.2);
          border-color: rgba(230,57,70,0.5);
          color: #E63946;
        }
        .mastering-panel .btn-secondary {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .mastering-panel .btn-secondary:hover {
          background: rgba(255,255,255,0.12);
        }
        .mastering-panel .btn-secondary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      <div className="mastering-panel">
        {/* Toolbar Header */}
        <div className="glass-toolbar">
          <span className="toolbar-title">Track Library</span>
          <span className="toolbar-hint">Click to select | Shift+Click for range</span>
          <div style={{ marginLeft: 'auto' }}>
            <VUMeter level={vuLevel} isActive={files.some(f => f.status === 'processing')} />
          </div>
        </div>

        {/* Upload Section */}
        <div className="upload-section">
          <div className="upload-label">Audio Input</div>
          <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} multiple={true} dataTestId="upload-zone" />
        </div>

        {/* File List */}
        <div className="file-list-container">
          {files.map((file, index) => {
            const statusTag = getStatusTag(file.status);
            const randomHeights = [10, 16, 12, 20, 14, 18, 10, 8];
            return (
              <div
                key={file.id}
                className={`glass-row ${file.selected ? 'selected' : ''}`}
                data-testid="file-item"
                onClick={(e) => toggleSelection(index, e.shiftKey)}
                onDoubleClick={() => handleEditFile(file)}
              >
                <div className="icon-circle">♪</div>
                <div className="waveform">
                  {randomHeights.map((h, i) => (
                    <div key={i} className="wave-bar" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <div className="file-info">
                  <div className="file-name">{file.filename}</div>
                  <div className="file-meta">
                    <span className="meta-val">{formatDuration(file.duration || 0)}</span>
                    <span>320 kbps</span>
                    <span>44.1 kHz</span>
                  </div>
                </div>
                <span className={`tag ${statusTag.class}`}>{statusTag.label}</span>
                <div className="check-circle">{file.selected && '✓'}</div>
                <button
                  className="edit-btn"
                  onClick={(e) => { e.stopPropagation(); handleEditFile(file); }}
                  title="Edit file"
                >
                  ✎
                </button>
                <button
                  className="edit-btn"
                  onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                  title="Remove file"
                  style={{ marginLeft: 2 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <button
            className="btn btn-primary"
            onClick={masterSelected}
            disabled={!files.some(f => f.selected && (f.status === 'idle' || f.status === 'error'))}
          >
            Master Selected
          </button>
          <button
            className="btn btn-secondary"
            onClick={masterAll}
            disabled={files.length === 0 || files.every(f => f.status === 'processing' || f.status === 'complete')}
          >
            Master All
          </button>
          <button
            className="btn btn-primary"
            onClick={saveToMusic}
            disabled={!hasMasteredSelected}
          >
            Save to Music
          </button>
          <button
            className="btn btn-ghost"
            onClick={downloadZip}
            disabled={selectedCount === 0}
          >
            Download ZIP
          </button>
          <button
            className="btn btn-ghost"
            onClick={selectAll}
            disabled={files.length === 0}
          >
            Select All
          </button>
          <div className="spacer" />
          {masteredCount > 0 && (
            <span className="stat"><strong>{masteredCount}</strong> mastered</span>
          )}
          {selectedCount > 0 && (
            <span className="stat" style={{ marginLeft: 8 }}><strong>{selectedCount}</strong> selected</span>
          )}
          {selectedCount > 0 && (
            <button className="btn btn-ghost" onClick={clearSelection}>Clear</button>
          )}
        </div>
      </div>
    </>
  );
}