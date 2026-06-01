import * as gdrive from '../../modules/storage/gdrive.js';
import logger from '../../utils/logger.js';

export const GDriveRoutes = [
  {
    // Connection status for the Settings UI.
    method: 'get',
    path: '/api/gdrive/status',
    handler: async (req, res) => {
      try {
        const configured = gdrive.isConfigured();
        const connected = configured ? await gdrive.isConnected() : false;
        res.json({ configured, connected });
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
  },
  {
    // Begin OAuth — returns the Google consent URL (or 503 if not configured).
    method: 'get',
    path: '/api/gdrive/auth',
    handler: (req, res) => {
      if (!gdrive.isConfigured()) return res.status(503).json({ error: 'Google Drive not configured' });
      res.json({ url: gdrive.getAuthUrl() });
    },
  },
  {
    // OAuth redirect target — exchanges the code, stores the refresh token.
    method: 'get',
    path: '/api/gdrive/callback',
    handler: async (req, res) => {
      if (!gdrive.isConfigured()) return res.status(503).send('Google Drive not configured');
      const { code } = req.query;
      if (!code) return res.status(400).send('Missing code');
      try {
        await gdrive.exchangeCode(String(code));
        res.send('<html><body style="font-family:sans-serif;background:#08020a;color:#fff;text-align:center;padding-top:80px"><h2>Google Drive connected ✓</h2><p>You can close this window.</p></body></html>');
      } catch (e) {
        logger.error('gdrive callback failed', { error: e.message });
        res.status(500).send(`Connection failed: ${e.message}`);
      }
    },
  },
  {
    // Disconnect — clears the stored refresh token.
    method: 'post',
    path: '/api/gdrive/disconnect',
    handler: async (req, res) => {
      try {
        const { SettingsModel } = await import('../../database/models/settings.model.js');
        await SettingsModel.set('gdrive_refresh_token', '');
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
  },
];
