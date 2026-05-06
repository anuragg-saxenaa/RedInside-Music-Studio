import { useState, useRef, useCallback } from 'react';

interface AudioUploadProps {
  projectId: string;
  onUploaded: (track: { id: string; filePath: string }) => void;
  acceptTypes?: string[];
  maxSizeMB?: number;
}

export default function AudioUpload({
  projectId,
  onUploaded,
  acceptTypes = ['.mp3', '.wav', '.flac'],
  maxSizeMB = 50,
}: AudioUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptTypes.includes(ext as never)) {
      return `Invalid file type. Accepted: ${acceptTypes.join(', ')}`;
    }
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum: ${maxSizeMB}MB`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('projectId', projectId);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          onUploaded({ id: response.id, filePath: response.filePath });
          setProgress(100);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setError(err.error || 'Upload failed');
          } catch {
            setError(`Upload failed: ${xhr.status}`);
          }
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        setError('Network error during upload');
      };

      xhr.open('POST', '/api/upload/audio');
      xhr.send(formData);
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'Upload failed');
    }
  };

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setFetching(true);
    setProgress(0);

    try {
      const response = await fetch('/api/upload/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), projectId }),
      });

      setFetching(false);

      if (response.ok) {
        const result = await response.json();
        onUploaded({ id: result.id, filePath: result.filePath });
      } else {
        const err = await response.json();
        setError(err.error || 'Fetch failed');
      }
    } catch (err: any) {
      setFetching(false);
      setError(err.message || 'Fetch failed');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      uploadFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      uploadFile(file);
    }
  };

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${dragOver ? '#E63946' : '#2A2A2A'}`,
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    backgroundColor: dragOver ? 'rgba(230, 57, 70, 0.05)' : '#141414',
    transition: 'all 150ms ease',
    cursor: 'pointer',
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#E63946',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drag & Drop Zone */}
      <div
        style={dropZoneStyle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ color: '#A0A0A0', fontSize: '14px', marginBottom: '8px' }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginBottom: '8px', color: dragOver ? '#E63946' : '#666666' }}
          >
            <path
              d="M12 16V8M12 8L9 11M12 8L15 11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 15V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div>Drag & drop audio file here</div>
          <div style={{ fontSize: '12px', color: '#666666', marginTop: '4px' }}>
            or click to browse
          </div>
          <div style={{ fontSize: '11px', color: '#555555', marginTop: '8px' }}>
            {acceptTypes.join(', ')} • Max {maxSizeMB}MB
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {(uploading || fetching) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A0A0A0' }}>
            <span>{uploading ? 'Uploading...' : 'Fetching from URL...'}</span>
            <span>{progress}%</span>
          </div>
          <div
            style={{
              height: '4px',
              backgroundColor: '#2A2A2A',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: '#E63946',
                transition: 'width 200ms ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Playback */}
      {previewUrl && (
        <div
          style={{
            backgroundColor: '#1E1E1E',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <audio src={previewUrl} controls style={{ height: '32px' }} />
          <span style={{ color: '#A0A0A0', fontSize: '12px' }}>
            {previewFile?.name || 'Preview'}
          </span>
        </div>
      )}

      {/* URL Input Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ color: '#A0A0A0', fontSize: '12px', fontWeight: 500 }}>
          Or fetch from URL
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/audio.mp3"
            disabled={uploading || fetching}
            style={{
              flex: 1,
              backgroundColor: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#FFFFFF',
              fontSize: '13px',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E63946')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#2A2A2A')}
          />
          <button
            onClick={fetchFromUrl}
            disabled={uploading || fetching || !urlInput.trim()}
            style={{
              ...buttonStyle,
              opacity: uploading || fetching || !urlInput.trim() ? 0.5 : 1,
              cursor: uploading || fetching || !urlInput.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {fetching ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            color: '#E63946',
            fontSize: '13px',
            padding: '8px 12px',
            backgroundColor: 'rgba(230, 57, 70, 0.1)',
            borderRadius: '6px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
