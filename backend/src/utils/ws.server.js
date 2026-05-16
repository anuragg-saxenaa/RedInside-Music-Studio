import { WebSocketServer } from 'ws';
import logger from './logger.js';

let wss = null;

export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
    ws.on('error', (err) => logger.error('WebSocket client error', { error: err.message }));
    ws.on('close', () => logger.debug('WebSocket client disconnected'));
    ws.send(JSON.stringify({ type: 'connected', message: 'RedInside Music Studio WS' }));
  });
  logger.info('WebSocket server initialized');
  return wss;
}

export function broadcast(event) {
  if (!wss) return;
  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}
