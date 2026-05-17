import { SettingsModel } from '../../database/models/settings.model.js';

const SENSITIVE_KEYS = new Set(['minimax_api_key']);

function maskValue(key, value) {
  if (SENSITIVE_KEYS.has(key) && value && value.length > 8) {
    return value.slice(0, 4) + '****' + value.slice(-4);
  }
  return value;
}

const SettingsController = {
  getAll(req, res) {
    const rows = SettingsModel.getAll();
    const result = {};
    rows.forEach(({ key, value, updated_at }) => {
      result[key] = { value: maskValue(key, value), updated_at };
    });
    res.json({ data: result });
  },

  get(req, res, next) {
    try {
      const row = SettingsModel.get(req.params.key);
      if (!row) return res.status(404).json({ error: 'Setting not found' });
      res.json({ data: { ...row, value: maskValue(row.key, row.value) } });
    } catch (err) { next(err); }
  },

  update(req, res, next) {
    try {
      const updates = req.body;
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return res.status(400).json({ error: 'Body must be a key-value object' });
      }
      const ALLOWED = new Set(['minimax_api_key', 'default_workflow_mode', 'auto_ffmpeg_320kbps', 'default_music_model', 'default_video_model']);
      const invalid = Object.keys(updates).filter(k => !ALLOWED.has(k));
      if (invalid.length) return res.status(400).json({ error: `Unknown settings: ${invalid.join(', ')}` });
      const rows = SettingsModel.setMany(updates);
      const result = {};
      rows.forEach(({ key, value, updated_at }) => {
        result[key] = { value: maskValue(key, value), updated_at };
      });
      if (updates.minimax_api_key) {
        process.env.MINIMAX_API_KEY = updates.minimax_api_key;
      }
      res.json({ data: result, message: 'Settings updated.' });
    } catch (err) { next(err); }
  },

  updateKey(req, res, next) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ error: 'value is required' });
      const ALLOWED = new Set(['minimax_api_key', 'default_workflow_mode', 'auto_ffmpeg_320kbps', 'default_music_model', 'default_video_model']);
      if (!ALLOWED.has(key)) return res.status(400).json({ error: `Unknown setting: ${key}` });
      const rows = SettingsModel.setMany({ [key]: value });
      const row = rows[0];
      if (key === 'minimax_api_key') process.env.MINIMAX_API_KEY = value;
      res.json({ data: { ...row, value: maskValue(row.key, row.value) }, message: 'Setting updated.' });
    } catch (err) { next(err); }
  },
};

export const SettingsRoutes = [
  { method: 'get', path: '/api/settings', handler: SettingsController.getAll },
  { method: 'get', path: '/api/settings/:key', handler: SettingsController.get },
  { method: 'patch', path: '/api/settings', handler: SettingsController.update },
  { method: 'patch', path: '/api/settings/:key', handler: SettingsController.updateKey },
];
