import { useState, useEffect } from 'react';

interface Trend {
  topic: string;
  hashtag: string;
  category: string;
  momentum: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  structure: string[];
  tags: string[];
}

interface HookAnalysis {
  score: number;
  sections: Array<{ section: string; score: number; feedback: string }>;
  suggestions: string[];
}

export default function ViralToolkit() {
  const [activeTab, setActiveTab] = useState<'trends' | 'templates' | 'hook'>('trends');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hookLyrics, setHookLyrics] = useState('');
  const [hookAnalysis, setHookAnalysis] = useState<HookAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'trends' && trends.length === 0) fetchTrends();
    if (activeTab === 'templates' && templates.length === 0) fetchTemplates();
  }, [activeTab]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/viral/trends');
      const data = await res.json();
      setTrends(data.data || []);
    } catch {
      setError('Failed to load trends');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/viral/templates');
      const data = await res.json();
      setTemplates(data.data || []);
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const analyzeHook = async () => {
    if (!hookLyrics.trim()) return;
    setLoading(true);
    setError(null);
    setHookAnalysis(null);
    try {
      const res = await fetch('/api/viral/analyze-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics: hookLyrics }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setHookAnalysis(data.data || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (tab: string) => ({
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms',
    backgroundColor: activeTab === tab ? '#E63946' : '#1E1E1E',
    color: activeTab === tab ? '#FFFFFF' : '#A0A0A0',
  } as React.CSSProperties);

  const getMomentumColor = (momentum: number) => {
    if (momentum >= 90) return '#00D26A';
    if (momentum >= 75) return '#FFB800';
    return '#A0A0A0';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
          Viral Toolkit
        </h2>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>
          Trending topics, song structure templates, and hook analysis for desi hip-hop.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button style={tabStyle('trends')} onClick={() => setActiveTab('trends')}>Trending Topics</button>
        <button style={tabStyle('templates')} onClick={() => setActiveTab('templates')}>Song Templates</button>
        <button style={tabStyle('hook')} onClick={() => setActiveTab('hook')}>Hook Analyzer</button>
      </div>

      <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', border: '1px solid #2A2A2A', minHeight: '400px' }}>
        {error && (
          <div style={{ color: '#E63946', padding: '12px', backgroundColor: 'rgba(230,57,70,0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #2A2A2A', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && !loading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                Trending in Desi Hip-Hop
              </h3>
              <button onClick={fetchTrends} style={{ backgroundColor: '#2A2A2A', color: '#A0A0A0', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                Refresh
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {trends.map((trend, i) => (
                <div key={i} style={{ backgroundColor: '#1E1E1E', borderRadius: '10px', padding: '16px 20px', border: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ color: '#666', fontSize: '18px', fontWeight: 700, minWidth: '32px', fontFamily: 'Outfit, sans-serif' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{trend.topic}</div>
                    <div style={{ color: '#E63946', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{trend.hashtag}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: getMomentumColor(trend.momentum), fontSize: '20px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                      {trend.momentum}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px' }}>momentum</div>
                  </div>
                  <div style={{ backgroundColor: '#2A2A2A', color: '#A0A0A0', fontSize: '11px', padding: '4px 10px', borderRadius: '20px' }}>
                    {trend.category}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && !loading && (
          <div>
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '20px', marginTop: 0 }}>
              Song Structure Templates
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {templates.map((template) => (
                <div key={template.id} style={{ backgroundColor: '#1E1E1E', borderRadius: '12px', padding: '20px', border: '1px solid #2A2A2A' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '4px' }}>{template.name}</div>
                      <div style={{ color: '#A0A0A0', fontSize: '13px' }}>{template.description}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {template.structure.map((section, i) => (
                      <span key={i} style={{ backgroundColor: '#2A2A2A', color: '#FFFFFF', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                        {section}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {template.tags?.map((tag, i) => (
                      <span key={i} style={{ backgroundColor: 'rgba(230,57,70,0.1)', color: '#E63946', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hook Analyzer Tab */}
        {activeTab === 'hook' && (
          <div>
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '8px', marginTop: 0 }}>
              Hook Analyzer
            </h3>
            <p style={{ color: '#A0A0A0', fontSize: '13px', marginBottom: '20px' }}>
              Paste your lyrics to get a viral potential score and section-by-section feedback.
            </p>
            <textarea
              value={hookLyrics}
              onChange={(e) => setHookLyrics(e.target.value)}
              placeholder="Paste your hook or full lyrics here..."
              rows={6}
              style={{ width: '100%', backgroundColor: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '12px 16px', color: '#FFFFFF', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
            />
            <button
              onClick={analyzeHook}
              disabled={loading || !hookLyrics.trim()}
              style={{ marginTop: '12px', backgroundColor: loading || !hookLyrics.trim() ? '#333' : '#E63946', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: loading || !hookLyrics.trim() ? 'not-allowed' : 'pointer', transition: 'all 150ms' }}
            >
              {loading ? 'Analyzing...' : 'Analyze Hook'}
            </button>

            {hookAnalysis && !loading && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', backgroundColor: '#1E1E1E', borderRadius: '12px', padding: '20px', border: '1px solid #2A2A2A' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: hookAnalysis.score >= 80 ? '#00D26A' : hookAnalysis.score >= 60 ? '#FFB800' : '#E63946' }}>
                      {hookAnalysis.score}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>viral score</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '8px', backgroundColor: '#2A2A2A', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hookAnalysis.score}%`, backgroundColor: hookAnalysis.score >= 80 ? '#00D26A' : hookAnalysis.score >= 60 ? '#FFB800' : '#E63946', borderRadius: '4px', transition: 'width 500ms ease' }} />
                    </div>
                  </div>
                </div>

                {hookAnalysis.sections && hookAnalysis.sections.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Section Analysis</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {hookAnalysis.sections.map((section, i) => (
                        <div key={i} style={{ backgroundColor: '#1E1E1E', borderRadius: '8px', padding: '12px 16px', border: '1px solid #2A2A2A' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 500 }}>{section.section}</span>
                            <span style={{ color: section.score >= 70 ? '#00D26A' : '#FFB800', fontSize: '13px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{section.score}/100</span>
                          </div>
                          <div style={{ color: '#A0A0A0', fontSize: '12px' }}>{section.feedback}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hookAnalysis.suggestions && hookAnalysis.suggestions.length > 0 && (
                  <div>
                    <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Suggestions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {hookAnalysis.suggestions.map((suggestion, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div style={{ color: '#E63946', fontSize: '16px', marginTop: '1px' }}>→</div>
                          <div style={{ color: '#A0A0A0', fontSize: '13px' }}>{suggestion}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
