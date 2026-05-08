import { useState, useCallback, useRef } from 'react';

interface UploadZoneProps {
  projectId: string;
  onUploadComplete: (fileId: string, filename: string) => void;
}

export default function UploadZone({ projectId, onUploadComplete }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/mastering/upload/${projectId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onUploadComplete(data.id, data.filename);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [projectId, onUploadComplete]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    await handleFile(file);
  }, [handleFile]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      data-testid="upload-zone"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        border: `2px dashed ${dragging ? '#FFB800' : '#2A2A2A'}`,
        borderRadius: '8px',
        padding: '40px',
        background: dragging ? 'rgba(255, 184, 0, 0.05)' : '#1A1A1A',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 200ms ease',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.m4a,.ogg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        style={{ display: 'none' }}
      />
      {uploading ? (
        <div style={{ color: '#FFB800' }}>Uploading...</div>
      ) : (
        <>
          <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
            Drag and drop audio file here or click to upload
          </div>
          <div style={{ color: '#555', fontSize: '12px' }}>
            MP3, WAV, FLAC, M4A, OGG up to 50MB
          </div>
        </>
      )}
    </div>
  );
}