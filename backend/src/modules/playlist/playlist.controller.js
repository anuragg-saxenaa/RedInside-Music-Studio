import { PlaylistModel } from './playlist.model.js';

export const PlaylistController = {
  async list(req, res, next) {
    try {
      res.json(PlaylistModel.findAll());
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      res.status(201).json(PlaylistModel.create(name.trim()));
    } catch (e) { next(e); }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      const pl = PlaylistModel.findById(id);
      if (!pl) return res.status(404).json({ error: 'Playlist not found' });
      res.json(PlaylistModel.update(id, name.trim()));
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      PlaylistModel.delete(id);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async getTracks(req, res, next) {
    try {
      const { id } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      res.json(PlaylistModel.getTracks(id));
    } catch (e) { next(e); }
  },

  async addTrack(req, res, next) {
    try {
      const { id } = req.params;
      const { musicId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      res.status(201).json(PlaylistModel.addTrack(id, musicId));
    } catch (e) { next(e); }
  },

  async removeTrack(req, res, next) {
    try {
      const { id, musicId } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      PlaylistModel.removeTrack(id, musicId);
      res.status(204).end();
    } catch (e) { next(e); }
  },
};
