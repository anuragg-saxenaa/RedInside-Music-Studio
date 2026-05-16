import { useEffect, useRef, useCallback } from 'react';

export interface WSEvent {
  type: 'connected' | 'job.started' | 'job.progress' | 'job.completed' | 'job.failed';
  jobId?: string;
  jobType?: string;
  projectId?: string;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
}

type WSHandler = (event: WSEvent) => void;

const WS_URL = `ws://${window.location.hostname}:3000`;
const RECONNECT_DELAY = 3000;

export function useWebSocket(onEvent: WSHandler) {
  const ws = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (unmounted.current) return;
    try {
      const socket = new WebSocket(WS_URL);
      ws.current = socket;

      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WSEvent;
          onEventRef.current(event);
        } catch { /* ignore malformed */ }
      };

      socket.onclose = () => {
        if (!unmounted.current) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch { /* ignore connection errors */ }
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
