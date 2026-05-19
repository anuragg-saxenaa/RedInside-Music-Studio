import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectModel } from '../../database/models/project.model.js';
import { MusicModel } from '../../database/models/music.model.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function generateToken() {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

export const ShareController = {
  async create(req, res, next) {
    try {
      const { id: projectId } = req.params;
      const project = ProjectModel.findById(projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

      db.prepare(
        `INSERT INTO project_shares (id, project_id, token, expires_at) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), projectId, token, expiresAt);

      res.status(201).json({ token, url: `/share/${token}`, expiresAt });
    } catch (e) { next(e); }
  },

  async view(req, res, next) {
    try {
      const { token } = req.params;
      const share = db.prepare(
        `SELECT * FROM project_shares WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`
      ).get(token);

      if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

      const project = ProjectModel.findById(share.project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const music = MusicModel.findByProject(share.project_id);

      res.json({ project, music, expiresAt: share.expires_at });
    } catch (e) { next(e); }
  },
};
