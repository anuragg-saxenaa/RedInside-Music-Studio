import { useState } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';

interface FileInfo {
  id: string;
  filename: string;
  status: 'idle' | 'processing' | 'complete';
}

interface AudioMasteringPanelProps {
  projectId: string;
  allMusic: any[];
}

export default function AudioMasteringPanel({ projectId, allMusic }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [processingLevel, setProcessingLevel] = useState(0);

  const handleUploadComplete = (fileId: string, filename: string) => {
    setFiles(prev => [...prev, { id: fileId, filename, status: 'idle' }]);
  };

  const masterFile = async (fileId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));

    const interval = setInterval(() => {
      setProcessingLevel(prev => Math.min(prev + 5, 80));
    }, 100);

    try {
      const response = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, projectId, preset: 'spotify', saveToProject: true }),
      });

      clearInterval(interval);
      setProcessingLevel(100);

      if (response.ok) {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete' } : f));
      }
    } catch (err) {
      clearInterval(interval);
      setProcessingLevel(0);
    }
  };

  return (
    <div data-testid="mastering-panel" style={{
      background: '#0D0D0D',
      padding: '24px',
      borderRadius: '8px',
    }}>
      <h3 style={{ color: '#FFFFFF', fontFamily: 'Bebas Neue', fontSize: '24px' }}>
        SPOTIFY MASTERING
      </h3>

      <div style={{ display: 'flex', gap: '24px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} />

          {files.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              {files.map(file => (
                <div key={file.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#1A1A1A',
                  borderRadius: '6px',
                  marginBottom: '8px',
                }}>
                  <span style={{ color: '#FFF' }}>{file.filename}</span>
                  {file.status === 'idle' && (
                    <button
                      data-testid={`master-btn-${file.id}`}
                      onClick={() => masterFile(file.id)}
                      style={{
                        background: '#E63946',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      Master
                    </button>
                  )}
                  {file.status === 'processing' && (
                    <span style={{ color: '#FFB800' }}>Processing...</span>
                  )}
                  {file.status === 'complete' && (
                    <span style={{ color: '#00FF00' }}>Complete</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: '120px', display: 'flex', alignItems: 'center' }}>
          <VUMeter level={processingLevel} isActive={processingLevel > 0} />
        </div>
      </div>
    </div>
  );
}