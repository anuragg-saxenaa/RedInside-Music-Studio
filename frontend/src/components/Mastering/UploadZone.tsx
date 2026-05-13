import { useState, useCallback, useRef, useEffect } from 'react';

interface UploadZoneProps {
  projectId: string;
  onUploadComplete: (files: Array<{ id: string; filename: string; originalPath?: string }>) => void;
  multiple?: boolean;
}

type UploadState = 'idle' | 'processing' | 'complete';

export default function UploadZone({ projectId, onUploadComplete, multiple = false }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadCount, setUploadCount] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;

    setUploadState('processing');
    setTotalUploads(files.length);
    setUploadCount(0);

    const uploadedFiles: Array<{ id: string; filename: string; originalPath?: string }> = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('files', file);

      try {
        const response = await fetch(`/api/mastering/upload/${projectId}`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Backend returns { files: [{ id, filename, originalPath, duration }] }
          if (data.files && data.files.length > 0) {
            uploadedFiles.push({ id: data.files[0].id, filename: data.files[0].filename, originalPath: data.files[0].originalPath });
          }
          setUploadCount(prev => prev + 1);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    if (uploadedFiles.length > 0) {
      setUploadState('complete');
      onUploadComplete(uploadedFiles);
      animationRef.current = setTimeout(() => {
        setUploadState('idle');
        setUploadCount(0);
        setTotalUploads(0);
      }, 2000);
    } else {
      setUploadState('idle');
      setUploadCount(0);
      setTotalUploads(0);
    }
  }, [projectId, onUploadComplete]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (multiple) {
      await handleFiles(files);
    } else {
      await handleFiles([files[0]]);
    }
  }, [handleFiles, multiple]);

  const handleClick = () => {
    if (uploadState !== 'processing') {
      inputRef.current?.click();
    }
  };

  const getLedColor = () => {
    switch (uploadState) {
      case 'processing':
        return '#FFB800'; // Amber - processing
      case 'complete':
        return '#00FF00'; // Green - complete
      default:
        return '#E63946'; // Red - idle/ready
    }
  };

  const getLedGlow = () => {
    switch (uploadState) {
      case 'processing':
        return '0 0 10px #FFB800, 0 0 20px #FFB80040';
      case 'complete':
        return '0 0 10px #00FF00, 0 0 20px #00FF0040';
      default:
        return '0 0 8px #E63946, 0 0 15px #E6394640';
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: '12px',
    padding: '40px',
    background: `
      linear-gradient(135deg, #1A1A1A 0%, #1F1F1F 25%, #1A1A1A 50%, #151515 75%, #1A1A1A 100%),
      linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)
    `,
    backgroundColor: '#1A1A1A',
    border: `2px solid ${dragging ? '#FFB800' : '#2A2A2A'}`,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.05),
      inset 0 -1px 0 rgba(0,0,0,0.3),
      0 4px 20px rgba(0,0,0,0.5),
      ${dragging ? '0 0 25px rgba(255,184,0,0.3)' : 'none'}
    `,
    textAlign: 'center',
    cursor: uploadState === 'processing' ? 'wait' : 'pointer',
    transition: 'all 200ms ease',
    overflow: 'hidden',
  };

  const ledContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  };

  const ledStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: getLedColor(),
    boxShadow: getLedGlow(),
    transition: 'all 200ms ease',
  };

  const statusTextStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#666',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '18px',
    fontWeight: 600,
    color: '#E0E0E0',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    color: '#555',
    marginBottom: '16px',
  };

  const formatsStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    color: '#444',
    letterSpacing: '0.5px',
  };

  const uploadIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  };

  const progressBarContainerStyle: React.CSSProperties = {
    width: '200px',
    height: '4px',
    backgroundColor: '#0D0D0D',
    borderRadius: '2px',
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '100%',
    width: '60%',
    background: 'linear-gradient(90deg, #FFB800, #E63946)',
    borderRadius: '2px',
    animation: 'pulse 1s ease-in-out infinite',
  };

  // Inject keyframes for progress bar animation
  useEffect(() => {
    const styleId = 'upload-zone-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: translateX(-10%); }
          50% { opacity: 1; transform: translateX(10%); }
        }
        @keyframes led-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes border-pulse {
          0%, 100% { border-color: #2A2A2A; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.5); }
          50% { border-color: #FFB800; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 0 25px rgba(255,184,0,0.3); }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      data-testid="upload-zone"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        ...containerStyle,
        animation: dragging ? 'border-pulse 1s ease-in-out infinite' : 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.m4a,.ogg"
        multiple={multiple}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) handleFiles(files);
        }}
        style={{ display: 'none' }}
      />

      {/* LED Status Indicators */}
      <div style={ledContainerStyle}>
        <div style={{
          ...ledStyle,
          animation: uploadState === 'processing' ? 'led-pulse 0.5s ease-in-out infinite' : 'none',
        }} />
        <span style={statusTextStyle}>
          {uploadState === 'processing' ? `Processing ${uploadCount}/${totalUploads}` : uploadState === 'complete' ? 'Complete' : 'Ready'}
        </span>
        <div style={{
          ...ledStyle,
          animation: uploadState === 'processing' ? 'led-pulse 0.5s ease-in-out infinite' : 'none',
        }} />
      </div>

      {uploadState === 'processing' ? (
        <div style={uploadIndicatorStyle}>
          <div style={titleStyle}>Uploading Audio</div>
          <div style={progressBarContainerStyle}>
            <div style={progressBarStyle} />
          </div>
          <div style={subtitleStyle}>Processing your file...</div>
        </div>
      ) : uploadState === 'complete' ? (
        <div style={uploadIndicatorStyle}>
          <div style={{
            fontSize: '32px',
            marginBottom: '8px',
            filter: 'drop-shadow(0 0 10px rgba(0,255,0,0.5))',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#00FF00"/>
            </svg>
          </div>
          <div style={{ ...titleStyle, color: '#00FF00' }}>Upload Complete</div>
          <div style={subtitleStyle}>Ready for mastering</div>
        </div>
      ) : (
        <div>
          <div style={titleStyle}>Drop Audio File Here</div>
          <div style={subtitleStyle}>or click to browse</div>
          <div style={formatsStyle}>
            MP3 / WAV / FLAC / M4A / OGG — up to 50MB
          </div>
        </div>
      )}

      {/* Corner accents for studio hardware feel */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        width: '20px',
        height: '20px',
        borderTop: '2px solid #FFB800',
        borderLeft: '2px solid #FFB800',
        opacity: dragging ? 1 : 0.3,
        transition: 'opacity 200ms ease',
      }} />
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '20px',
        height: '20px',
        borderTop: '2px solid #FFB800',
        borderRight: '2px solid #FFB800',
        opacity: dragging ? 1 : 0.3,
        transition: 'opacity 200ms ease',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        width: '20px',
        height: '20px',
        borderBottom: '2px solid #E63946',
        borderLeft: '2px solid #E63946',
        opacity: 0.3,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        width: '20px',
        height: '20px',
        borderBottom: '2px solid #E63946',
        borderRight: '2px solid #E63946',
        opacity: 0.3,
      }} />
    </div>
  );
}
