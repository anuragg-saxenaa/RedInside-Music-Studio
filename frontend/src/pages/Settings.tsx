import { useState, useEffect } from 'react';
import { pwaDisabled, unregisterSW, enablePWA } from '../pwa/registerSW';

interface SettingRow {
  value: string;
  updated_at: string;
}

interface SettingsData {
  minimax_api_key: SettingRow;
  default_workflow_mode: SettingRow;
  auto_ffmpeg_320kbps: SettingRow;
  default_music_model: SettingRow;
  default_video_model: SettingRow;
}

const BACKEND = 'http://localhost:3000';

// Google Drive sync — connect your own Google account; new songs + artwork are
// copied to a "RedInside Music Studio" folder in your Drive. Uses relative /api
// so the global fetch interceptor routes it to the cloud backend.
function GoogleDriveSection() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => fetch('/api/gdrive/status').then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false, connected: false }));
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/gdrive/auth');
      if (r.status === 503) { alert('Google Drive is not configured yet — add the Google OAuth env vars on the backend.'); return; }
      const { url } = await r.json();
      if (url) window.open(url, '_blank');
    } finally { setBusy(false); }
  };
  const disconnect = async () => { setBusy(true); try { await fetch('/api/gdrive/disconnect', { method: 'POST' }); await refresh(); } finally { setBusy(false); } };

  const connected = status?.connected;
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px', marginTop: 0 }}>Google Drive Sync</h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#1E1E1E', borderRadius: '10px', border: '1px solid #2A2A2A', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>
            {connected ? 'Connected ✓' : 'Back up to your Google Drive'}
          </div>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
            {status == null ? 'Checking…'
              : !status.configured ? 'Not set up yet — backend needs Google OAuth env vars.'
              : connected ? 'New songs & artwork are copied to a folder in your Drive.'
              : 'Sign in with your Google account to sync songs & artwork.'}
          </div>
        </div>
        <button
          onClick={connected ? disconnect : connect}
          disabled={busy || (status != null && !status.configured)}
          style={{
            flexShrink: 0, padding: '9px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: busy || (status != null && !status.configured) ? 'not-allowed' : 'pointer',
            backgroundColor: connected ? '#2A2A2A' : '#E63946', color: '#fff', opacity: (status != null && !status.configured) ? 0.5 : 1,
          }}
        >
          {busy ? '…' : connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

// Owner-only one-time setup: paste a throwaway YouTube account's cookies.txt so
// ALL downloads (every user, every platform) authenticate server-side. No per-user setup.
function YoutubeCookiesSection() {
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const refresh = () => fetch('/api/youtube/cookies/status').then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!val.trim()) return;
    setBusy(true); setSaved(false);
    try {
      const r = await fetch('/api/youtube/cookies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: val }) });
      if (r.ok) { setSaved(true); setVal(''); await refresh(); } else { const d = await r.json(); alert(d.error || 'Failed'); }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '8px', marginTop: 0 }}>YouTube Downloads</h3>
      <div style={{ padding: '14px 16px', backgroundColor: '#1E1E1E', borderRadius: '10px', border: '1px solid #2A2A2A' }}>
        <div style={{ color: status?.configured ? '#00D26A' : '#FFB800', fontSize: '13px', fontWeight: 600, marginBottom: 6 }}>
          {status == null ? 'Checking…' : status.configured ? 'Connected ✓ — downloads authenticated server-side' : 'Not set up — paste a YouTube cookies.txt once'}
        </div>
        <div style={{ color: '#666', fontSize: '11px', lineHeight: 1.5, marginBottom: 10 }}>
          One-time owner setup. Use a <b>throwaway</b> YouTube account: log into youtube.com → Chrome extension “Get cookies.txt LOCALLY” → Export → paste the file contents below. Works for every user on all platforms; refresh here if it ever expires.
        </div>
        <textarea
          value={val} onChange={e => setVal(e.target.value)}
          placeholder="# Netscape HTTP Cookie File … (paste cookies.txt contents)"
          style={{ width: '100%', minHeight: 90, background: '#121212', border: '1px solid #2A2A2A', borderRadius: 8, color: '#ccc', fontSize: 11, fontFamily: 'monospace', padding: 10, resize: 'vertical', boxSizing: 'border-box' }}
        />
        <button onClick={save} disabled={busy || !val.trim()} style={{ marginTop: 8, padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: busy || !val.trim() ? 'default' : 'pointer', background: saved ? '#00D26A' : '#E63946', color: '#fff', opacity: !val.trim() ? 0.5 : 1 }}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save cookies'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pwaOn, setPwaOn] = useState(!pwaDisabled());

  const togglePwa = async () => {
    if (pwaOn) { await unregisterSW(); setPwaOn(false); }
    else { enablePWA(); setPwaOn(true); location.reload(); }
  };

  useEffect(() => {
    fetch(`${BACKEND}/api/settings`)
      .then(r => r.json())
      .then(({ data }) => {
        setSettings(data);
        setForm({
          minimax_api_key: '',
          default_workflow_mode: data.default_workflow_mode?.value || 'hybrid',
          auto_ffmpeg_320kbps: data.auto_ffmpeg_320kbps?.value || 'true',
          default_music_model: data.default_music_model?.value || 'music-2.6',
          default_video_model: data.default_video_model?.value || 'MiniMax-Hailuo-2.3',
        });
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload: Record<string, string> = { ...form };
      if (!payload.minimax_api_key) delete payload.minimax_api_key;
      const res = await fetch(`${BACKEND}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.data);
      setForm(f => ({ ...f, minimax_api_key: '' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, type: 'text' | 'select', opts?: string[]) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {type === 'select' ? (
        <select
          value={form[key] || ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width: '100%', backgroundColor: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', fontSize: '14px', outline: 'none' }}
        >
          {opts?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={key === 'minimax_api_key' && !showKey ? 'password' : 'text'}
          value={form[key] || ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={key === 'minimax_api_key' ? (settings.minimax_api_key?.value || 'Enter API key...') : ''}
          style={{ width: '100%', backgroundColor: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
          Settings
        </h2>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>
          Configure API keys and generation defaults.
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#A0A0A0', fontSize: '14px' }}>Loading...</div>
      ) : (
        <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', border: '1px solid #2A2A2A' }}>
          {error && (
            <div style={{ color: '#E63946', padding: '10px 14px', backgroundColor: 'rgba(230,57,70,0.1)', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #2A2A2A' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px', marginTop: 0 }}>MiniMax API</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                API Key
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.minimax_api_key || ''}
                  onChange={e => setForm(f => ({ ...f, minimax_api_key: e.target.value }))}
                  placeholder={settings.minimax_api_key?.value ? 'Enter new key to update...' : 'Enter MiniMax API key...'}
                  style={{ flex: 1, backgroundColor: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', fontSize: '14px', outline: 'none' }}
                />
                <button
                  onClick={() => setShowKey(s => !s)}
                  style={{ backgroundColor: '#2A2A2A', border: 'none', borderRadius: '8px', padding: '10px 14px', color: '#A0A0A0', cursor: 'pointer', fontSize: '13px' }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              {settings.minimax_api_key?.value && (
                <div style={{ color: '#666', fontSize: '11px', marginTop: '6px' }}>
                  Current: {settings.minimax_api_key.value} — new key takes effect immediately
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #2A2A2A' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px', marginTop: 0 }}>Generation Defaults</h3>
            {field('Default Music Model', 'default_music_model', 'select', ['music-2.6', 'music-cover'])}
            {field('Default Video Model', 'default_video_model', 'select', ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-02', 'S2V-01'])}
            {field('Workflow Mode', 'default_workflow_mode', 'select', ['hybrid', 'auto', 'manual'])}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px', marginTop: 0 }}>Processing</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#1E1E1E', borderRadius: '10px', border: '1px solid #2A2A2A' }}>
              <div>
                <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>Auto FFmpeg 320kbps</div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>Convert generated audio to 320kbps after generation</div>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, auto_ffmpeg_320kbps: f.auto_ffmpeg_320kbps === 'true' ? 'false' : 'true' }))}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  backgroundColor: form.auto_ffmpeg_320kbps === 'true' ? '#E63946' : '#2A2A2A',
                  position: 'relative', transition: 'background-color 200ms',
                }}
              >
                <div style={{
                  position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff',
                  transition: 'left 200ms', left: form.auto_ffmpeg_320kbps === 'true' ? '23px' : '3px',
                }} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px', marginTop: 0 }}>Offline App (PWA)</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#1E1E1E', borderRadius: '10px', border: '1px solid #2A2A2A' }}>
              <div>
                <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>Install & offline downloads</div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>Service worker for installability + offline playback. Turn off to disable.</div>
              </div>
              <button
                onClick={togglePwa}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  backgroundColor: pwaOn ? '#E63946' : '#2A2A2A', position: 'relative', transition: 'background-color 200ms',
                }}
              >
                <div style={{ position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 200ms', left: pwaOn ? '23px' : '3px' }} />
              </button>
            </div>
          </div>

          <GoogleDriveSection />
          <YoutubeCookiesSection />

          <button
            onClick={save}
            disabled={saving}
            style={{
              width: '100%', backgroundColor: saving ? '#333' : saved ? '#00D26A' : '#E63946',
              color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px 24px',
              fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background-color 200ms',
            }}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
