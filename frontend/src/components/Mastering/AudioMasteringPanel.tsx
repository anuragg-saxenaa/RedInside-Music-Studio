import { useState } from 'react';
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

// Screw/Bolt decoration component
const CornerScrew = ({ style }: { style?: React.CSSProperties }) => (
  <div style={{
    position: 'absolute',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'linear-gradient(145deg, #4a4a4a 0%, #2a2a2a 50%, #1a1a1a 100%)',
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.5)',
    ...style,
  }}>
    {/* Screw slot */}
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) rotate(-45deg)',
      width: '6px',
      height: '1px',
      background: 'linear-gradient(90deg, #111 0%, #333 50%, #111 100%)',
      boxShadow: '0 0 1px rgba(0,0,0,0.8)',
    }} />
  </div>
);

// LED indicator styled as equipment LED
const EquipmentLED = ({ status }: { status: FileInfo['status'] }) => {
  const colors = {
    complete: { bg: '#00FF00', glow: '0 0 12px #00FF00, 0 0 20px #00FF00' },
    processing: { bg: '#FFB800', glow: '0 0 12px #FFB800, 0 0 20px #FFB800' },
    error: { bg: '#E63946', glow: '0 0 12px #E63946, 0 0 20px #E63946' },
    uploading: { bg: '#FFB800', glow: '0 0 12px #FFB800, 0 0 20px #FFB800' },
    idle: { bg: '#333', glow: 'none' },
  };
  const color = colors[status] || colors.idle;
  return (
    <div style={{
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${color.bg}, ${status === 'idle' ? '#222' : color.bg}88)`,
      boxShadow: color.glow,
      border: '1px solid rgba(255,255,255,0.1)',
    }} />
  );
};

export default function AudioMasteringPanel({ projectId, allMusic: _allMusic }: AudioMasteringPanelProps) {
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

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 50%, #0d0d0d 100%)',
      borderRadius: '16px',
      border: '1px solid #3a3a3a',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Brushed metal texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.01) 1px, transparent 2px)',
        pointerEvents: 'none',
      }} />

      {/* Corner screws */}
      <CornerScrew style={{ top: '12px', left: '12px' }} />
      <CornerScrew style={{ top: '12px', right: '12px' }} />
      <CornerScrew style={{ bottom: '12px', left: '12px' }} />
      <CornerScrew style={{ bottom: '12px', right: '12px' }} />

      {/* Header panel - equipment display style */}
      <div style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
        borderBottom: '1px solid #2a2a2a',
        padding: '20px 28px',
        position: 'relative',
      }}>
        {/* Header groove/line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '20px',
          right: '20px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, #444 20%, #444 80%, transparent 100%)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Power LED */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00FF00',
                boxShadow: '0 0 8px #00FF00, 0 0 12px #00FF00',
              }} />
              <h3 style={{
                color: '#FFFFFF',
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '26px',
                letterSpacing: '3px',
                margin: 0,
                textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 30px rgba(230, 57, 70, 0.2)',
              }}>
                SPOTIFY MASTERING
              </h3>
            </div>
            <p style={{
              color: '#666',
              fontSize: '11px',
              margin: '6px 0 0 20px',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '1px',
            }}>
              PROFESSIONAL AUDIO MASTERING PROCESSOR
            </p>
          </div>

          {/* LUFS target display */}
          <div style={{
            background: 'linear-gradient(180deg, #0a0a0a 0%, #151515 100%)',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}>
            <span style={{
              color: '#888',
              fontSize: '9px',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '1px',
            }}>TARGET</span>
            <span style={{
              color: '#00FF00',
              fontSize: '18px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 'bold',
              textShadow: '0 0 8px rgba(0,255,0,0.5)',
            }}>-14</span>
            <span style={{
              color: '#555',
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
            }}>LUFS</span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div style={{
        padding: '28px',
        display: 'flex',
        gap: '32px',
        alignItems: 'flex-start',
      }}>
        {/* Left column - Upload zone and file list */}
        <div style={{ flex: 1 }}>
          {/* Upload section with metallic frame */}
          <div style={{
            background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
            borderRadius: '12px',
            border: '1px solid #333',
            padding: '20px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.03)',
          }}>
            {/* Section label */}
            <div style={{
              color: '#555',
              fontSize: '10px',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '2px',
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              AUDIO INPUT
            </div>
            <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Section label */}
              <div style={{
                color: '#555',
                fontSize: '10px',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '2px',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}>
                QUEUE ({files.length})
              </div>
              {files.map(file => (
                <div key={file.id} style={{
                  background: 'linear-gradient(180deg, #1e1e1e 0%, #161616 100%)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  border: '1px solid #2a2a2a',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 8px rgba(0,0,0,0.3)',
                  position: 'relative',
                }}>
                  {/* Metallic frame accent line on left */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: '3px',
                    background: file.status === 'complete' ? 'linear-gradient(180deg, #00FF00, #00AA00)' :
                               file.status === 'processing' ? 'linear-gradient(180deg, #FFB800, #CC7000)' :
                               file.status === 'error' ? 'linear-gradient(180deg, #E63946, #AA2233)' : '#333',
                    borderRadius: '0 2px 2px 0',
                  }} />

                  {/* File header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                      <EquipmentLED status={file.status} />
                      <span style={{
                        color: '#CCC',
                        fontSize: '13px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 500,
                      }}>{file.filename}</span>
                    </div>
                    {file.status === 'idle' && (
                      <button
                        onClick={() => masterFile(file.id)}
                        style={{
                          background: 'linear-gradient(180deg, #E63946 0%, #B8232E 100%)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 18px',
                          color: '#FFF',
                          fontSize: '11px',
                          fontFamily: 'Bebas Neue, sans-serif',
                          letterSpacing: '1px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(230, 57, 70, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                          transition: 'all 150ms ease',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(230, 57, 70, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(230, 57, 70, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
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
                          padding: '5px 10px',
                          color: '#E63946',
                          fontSize: '10px',
                          fontFamily: 'Outfit, sans-serif',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(file.status === 'processing' || file.status === 'complete') && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{
                        height: '4px',
                        background: '#1a1a1a',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${file.progress}%`,
                          background: file.status === 'complete'
                            ? 'linear-gradient(90deg, #00FF00 0%, #00CC00 100%)'
                            : 'linear-gradient(90deg, #FFB800 0%, #FF8C00 100%)',
                          borderRadius: '2px',
                          transition: 'width 200ms ease',
                          boxShadow: file.status === 'complete' ? '0 0 10px #00FF00' : '0 0 8px #FFB800',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Status text with progress percentage */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    paddingLeft: '8px',
                  }}>
                    <span style={{
                      color: file.status === 'complete' ? '#00FF00' :
                             file.status === 'processing' ? '#FFB800' :
                             file.status === 'error' ? '#E63946' : '#555',
                    }}>
                      {file.status === 'uploading' && 'UPLOADING...'}
                      {file.status === 'idle' && 'READY'}
                      {file.status === 'processing' && 'PROCESSING...'}
                      {file.status === 'complete' && 'COMPLETE'}
                      {file.status === 'error' && (file.error || 'ERROR')}
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

        {/* Right column - VU Meter section */}
        <div style={{
          width: '120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* VU Meter panel frame */}
          <div style={{
            background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
            border: '1px solid #333',
            borderRadius: '10px',
            padding: '16px 12px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03)',
          }}>
            {/* Section label */}
            <div style={{
              color: '#666',
              fontSize: '9px',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '1px',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              OUTPUT LEVEL
            </div>

            <VUMeter level={vuLevel} isActive={files.some(f => f.status === 'processing')} />

            {/* LUFS display */}
            <div style={{
              marginTop: '12px',
              textAlign: 'center',
              padding: '8px',
              background: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #222',
            }}>
              <div style={{
                color: '#444',
                fontSize: '8px',
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: '2px',
              }}>INTEGRATED</div>
              <div style={{
                color: vuLevel > 80 ? '#FFB800' : vuLevel > 50 ? '#00FF00' : '#666',
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 'bold',
                textShadow: vuLevel > 50 ? '0 0 8px currentColor' : 'none',
              }}>
                {vuLevel > 0 ? `-${Math.round((100 - vuLevel) * 0.2)}` : '---'}
              </div>
              <div style={{
                color: '#444',
                fontSize: '8px',
                fontFamily: 'JetBrains Mono, monospace',
              }}>LUFS</div>
            </div>
          </div>

          {/* Status indicators row */}
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '4px',
          }}>
            {files.some(f => f.status === 'complete') && (
              <div style={{
                padding: '4px 8px',
                background: '#0a0a0a',
                borderRadius: '4px',
                border: '1px solid #222',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#00FF00',
                  boxShadow: '0 0 6px #00FF00',
                }} />
                <span style={{
                  color: '#00FF00',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {files.filter(f => f.status === 'complete').length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom groove line */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, #2a2a2a 20%, #2a2a2a 80%, transparent 100%)',
        marginTop: '8px',
      }} />

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
