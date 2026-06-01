import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * App-wide error boundary. A render error in any subtree shows a recoverable
 * panel instead of a blank white/black screen — production-grade safety net so
 * a single bad API response or component bug can never take down the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for diagnostics (and any future telemetry hook).
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });
  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#0a0608', color: '#fff', fontFamily: 'Outfit, system-ui, sans-serif',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Something hit a snag</div>
        <div style={{ fontSize: 14, opacity: 0.6, maxWidth: 460, lineHeight: 1.5 }}>
          The view crashed but your data is safe. Try again, or reload the app.
        </div>
        <pre style={{
          fontSize: 11, opacity: 0.45, maxWidth: 520, maxHeight: 120, overflow: 'auto',
          fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap',
        }}>{String(this.state.error?.message || this.state.error)}</pre>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={this.reset} style={btn(false)}>Try again</button>
          <button onClick={this.reload} style={btn(true)}>Reload app</button>
        </div>
      </div>
    );
  }
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
    background: primary ? '#E63946' : 'transparent',
    color: '#fff', fontFamily: 'inherit',
  };
}

export default ErrorBoundary;
