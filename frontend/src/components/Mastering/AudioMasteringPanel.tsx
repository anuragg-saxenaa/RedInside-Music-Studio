import { useState, useEffect } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';

interface FileInfo {
  id: string;
  filename: string;
  status: 'uploading' | 'idle' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface AudioMasteringPanelProps {
  projectId: string;
  allMusic: any[];
}

export default function AudioMasteringPanel({ projectId, allMusic }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [vuLevel, setVuLevel] = useState(0);

  const handleUploadComplete = (fileId: string, filename: string) => {
    setFiles(prev => [...prev, { id: fileId, filename, status: 'idle', progress: 0 }]);
  };

  const masterFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    // Start with uploading status while we prepare
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing', progress: 5 } : f));

    // Animate VU meter while processing
    const vuInterval = setInterval(() => {
      setVuLevel(prev => {
        const noise = Math.random() * 20;
        return Math.min(85, prev + noise);
      });
    }, 150);

    try {
      const response = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, projectId, preset: 'spotify', saveToProject: true }),
      });

      clearInterval(vuInterval);
      setVuLevel(100);

      if (response.ok) {
        const data = await response.json();
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

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #0D0D0D 0%, #1A1A1A 100%)',
      padding: '32px',
      borderRadius: '12px',
      border: '1px solid #2A2A2A',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{
          color: '#FFFFFF',
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: '28px',
          letterSpacing: '2px',
          margin: 0,
          textShadow: '0 0 20px rgba(230, 57, 70, 0.3)',
        }}>
          SPOTIFY MASTERING
        </h3>
        <p style={{
          color: '#666',
          fontSize: '12px',
          margin: '8px 0 0 0',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          Apply Spotify loudness standard (LUFS -14)
        </p>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        {/* Left column - Upload zone and file list */}
        <div style={{ flex: 1 }}>
          <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} />

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {files.map(file => (
                <div key={file.id} style={{
                  background: 'linear-gradient(180deg, #1E1E1E 0%, #161616 100%)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #2A2A2A',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                  {/* File header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Status indicator LED */}
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: file.status === 'complete' ? '#00FF00' :
                                   file.status === 'processing' ? '#FFB800' :
                                   file.status === 'error' ? '#E63946' : '#444',
                        boxShadow: file.status === 'complete' ? '0 0 8px #00FF00' :
                                   file.status === 'processing' ? '0 0 8px #FFB800' :
                                   file.status === 'error' ? '0 0 8px #E63946' : 'none',
                        animation: file.status === 'processing' ? 'pulse 1s infinite' : 'none',
                      }} />
                      <span style={{
                        color: '#FFF',
                        fontSize: '14px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 500,
                      }}>{file.filename}</span>
                    </div>
                    {file.status === 'idle' && (
                      <button
                        onClick={() => masterFile(file.id)}
                        style={{
                          background: 'linear-gradient(180deg, #E63946 0%, #C62B38 100%)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '10px 20px',
                          color: '#FFF',
                          fontSize: '12px',
                          fontFamily: 'Bebas Neue, sans-serif',
                          letterSpacing: '1px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)',
                          transition: 'all 150ms ease',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(230, 57, 70, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(230, 57, 70, 0.3)';
                        }}
                      >
                        MASTER
                      </button>
                    )}
                    {file.status === 'error' && (
                      <button
                        onClick={() => removeFile(file.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #E63946',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          color: '#E63946',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(file.status === 'processing' || file.status === 'complete') && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{
                        height: '4px',
                        background: '#2A2A2A',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${file.progress}%`,
                          background: file.status === 'complete'
                            ? 'linear-gradient(90deg, #00FF00 0%, #00CC00 100%)'
                            : 'linear-gradient(90deg, #FFB800 0%, #FF8C00 100%)',
                          borderRadius: '2px',
                          transition: 'width 200ms ease',
                          boxShadow: file.status === 'complete' ? '0 0 8px #00FF00' : 'none',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Status text with progress percentage */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    <span style={{
                      color: file.status === 'complete' ? '#00FF00' :
                             file.status === 'processing' ? '#FFB800' :
                             file.status === 'error' ? '#E63946' : '#666',
                    }}>
                      {file.status === 'uploading' && 'Uploading...'}
                      {file.status === 'idle' && 'Ready to master'}
                      {file.status === 'processing' && 'Mastering in progress...'}
                      {file.status === 'complete' && 'Mastering complete!'}
                      {file.status === 'error' && (file.error || 'Processing failed')}
                    </span>
                    {file.status === 'processing' && (
                      <span style={{ color: '#FFB800' }}>{file.progress}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column - VU Meter */}
        <div style={{
          width: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            color: '#666',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '1px',
          }}>
            LEVEL
          </div>
          <VUMeter level={vuLevel} isActive={files.some(f => f.status === 'processing')} />
          <div style={{
            color: '#444',
            fontSize: '9px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            -14 LUFS
          </div>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
