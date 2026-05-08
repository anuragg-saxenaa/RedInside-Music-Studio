import { useState, useEffect } from 'react';

interface ArtworkGeneratorProps {
  projectId: string;
  musicId?: string; // If provided, artwork is per-music version
  onSelectArtwork?: (imageUrl: string) => void;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (1024×1024)' },
  { value: '16:9', label: '16:9 (1280×720)' },
  { value: '4:3', label: '4:3 (1152×864)' },
  { value: '9:16', label: '9:16 (720×1280)' },
  { value: '3:2', label: '3:2 (1248×832)' },
  { value: '2:3', label: '2:3 (832×1248)' },
];

export default function ArtworkGenerator({ projectId, musicId, onSelectArtwork }: ArtworkGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<Array<{ id: number; imageUrls: string[]; prompt: string }>>([]);
  const [n, setN] = useState(1);

  // Determine artwork URL based on whether musicId is provided
  const artworkApiUrl = musicId
    ? `/api/projects/${projectId}/artwork/${musicId}`
    : `/api/projects/${projectId}/artwork`;

  useEffect(() => {
    fetch(`/api/projects/${projectId}/images`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setImages(data.map(img => ({
            id: img.id,
            imageUrls: typeof img.image_urls === 'string' ? JSON.parse(img.image_urls) : img.imageUrls || [],
            prompt: img.prompt,
          })));
        }
      })
      .catch(console.error);
  }, [projectId]);

  const generateArtwork = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt, aspectRatio, n }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert(result.error || 'Artwork generation failed');
        return;
      }
      setImages(prev => [result, ...prev]);
    } catch (err) {
      console.error('Artwork generation failed:', err);
      alert('Network error - please try again');
    } finally {
      setGenerating(false);
    }
  };

  const saveArtwork = async (imageUrl: string) => {
    try {
      // Fetch image as blob and convert to base64 to avoid CORS issues
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const body: { imageUrl: string; musicId?: string } = { imageUrl: base64 };
      if (musicId) {
        body.musicId = musicId;
      }

      const saveResponse = await fetch(`/api/projects/${projectId}/artwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (saveResponse.ok) {
        onSelectArtwork?.(artworkApiUrl);
      } else {
        console.error('Failed to save artwork locally');
        const data = await saveResponse.json();
        alert(data.error || 'Failed to save artwork');
      }
    } catch (err) {
      console.error('Failed to save artwork:', err);
      alert('Network error - please try again');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
          Generate Artwork
        </h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>
          Create album artwork, artist images, and cover art using AI
        </p>
      </div>

      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Describe your artwork
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic portrait of a rapper in a dimly lit studio with red LED lights..."
          maxLength={1500}
          style={{
            width: '100%',
            height: '100px',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            resize: 'none',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {ASPECT_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Count</label>
          <select
            value={n}
            onChange={(e) => setN(parseInt(e.target.value))}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {[1,2,3,4,5,6,7,8,9].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={generateArtwork}
        disabled={generating || !prompt.trim()}
        style={{
          backgroundColor: generating || !prompt.trim() ? '#666666' : '#E63946',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
        onMouseOver={(e) => { if (!generating && prompt.trim()) e.currentTarget.style.backgroundColor = '#FF4757'; }}
        onMouseOut={(e) => { if (!generating && prompt.trim()) e.currentTarget.style.backgroundColor = '#E63946'; }}
      >
        {generating ? 'Generating...' : 'Generate Artwork'}
      </button>

      {images.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Generated Artwork</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {images.map(img => (
              img.imageUrls.map((url, i) => (
                <div key={`${img.id}-${i}`} style={{ backgroundColor: '#1E1E1E', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={url} alt={`Artwork ${i + 1}`} style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <div style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        console.log('Set theme clicked:', url);
                        saveArtwork(url);
                      }}
                      style={{ backgroundColor: '#E63946', border: 'none', borderRadius: '6px', padding: '10px 16px', color: '#FFFFFF', fontSize: '13px', cursor: 'pointer', flex: 1, fontWeight: 600 }}
                    >
                      Set Theme
                    </button>
                    <a href={url} download style={{ backgroundColor: '#2A2A2A', borderRadius: '6px', padding: '10px 16px', color: '#FFFFFF', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</a>
                  </div>
                </div>
              ))
            ))}
          </div>
        </div>
      )}
    </div>
  );
}