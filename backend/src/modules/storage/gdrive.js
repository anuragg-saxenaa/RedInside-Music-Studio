// Optional Google Drive storage backend (Drive v3 REST, no SDK).
// Disabled unless GOOGLE_CLIENT_ID/SECRET are configured. A refresh token,
// obtained via the OAuth flow, is stored in the settings table.
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_FOLDER = 'RedInside-Music-Studio';
const SETTING_KEY = 'gdrive_refresh_token';

export function isConfigured() {
  return !!(config.gdrive.clientId && config.gdrive.clientSecret && config.gdrive.redirectUri);
}

export function getAuthUrl(state = '') {
  if (!isConfigured()) throw new Error('Google Drive not configured');
  const p = new URLSearchParams({
    client_id: config.gdrive.clientId,
    redirect_uri: config.gdrive.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function settings() {
  const { SettingsModel } = await import('../../database/models/settings.model.js');
  return SettingsModel;
}

export async function isConnected() {
  const S = await settings();
  const row = await S.get(SETTING_KEY);
  return !!row?.value;
}

// Exchange an OAuth code for tokens; persist the refresh token.
export async function exchangeCode(code) {
  if (!isConfigured()) throw new Error('Google Drive not configured');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.gdrive.clientId,
      client_secret: config.gdrive.clientSecret,
      redirect_uri: config.gdrive.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!data.refresh_token) throw new Error('No refresh_token returned (revoke prior consent and retry)');
  const S = await settings();
  await S.set(SETTING_KEY, data.refresh_token);
  return true;
}

let _accessToken = { value: '', expiresAt: 0 };
export async function getAccessToken() {
  if (_accessToken.value && Date.now() < _accessToken.expiresAt - 60000) return _accessToken.value;
  const S = await settings();
  const refresh = (await S.get(SETTING_KEY))?.value;
  if (!refresh) throw new Error('Google Drive not connected');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gdrive.clientId,
      client_secret: config.gdrive.clientSecret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  _accessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return _accessToken.value;
}

// Map a storage key (e.g. projects/p1/generations/music/v1.mp3) to a flat Drive
// filename, namespaced under the root folder. Drive is flat-friendly; we encode
// the path into the name to avoid deep folder trees.
export function keyToDriveName(key) {
  return key.replace(/^\/+/, '').split('/').join('__');
}

async function findRootFolderId(token) {
  const q = encodeURIComponent(`name='${ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ROOT_FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return (await create.json()).id;
}

async function findFileId(token, name, parentId) {
  const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

export async function uploadFile(key, buffer, mime = 'application/octet-stream') {
  const token = await getAccessToken();
  const parentId = await findRootFolderId(token);
  const name = keyToDriveName(key);
  const existing = await findFileId(token, name, parentId);
  const boundary = 'ris' + Math.random().toString(36).slice(2);
  const metadata = existing ? { name } : { name, parents: [parentId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    Buffer.from(buffer),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  logger.info('gdrive upload ok', { key });
  return key;
}

export async function downloadFile(key) {
  const token = await getAccessToken();
  const parentId = await findRootFolderId(token);
  const id = await findFileId(token, keyToDriveName(key), parentId);
  if (!id) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
