import { AlbumModel } from './album.model.js';

export const AlbumController = {
  async list(req, res, next) {
    try {
      const { id: projectId } = req.params;
      res.json(await AlbumModel.findByProject(projectId));
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { id: projectId } = req.params;
      const { title, artist, year, genre, label } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
      res.status(201).json(await AlbumModel.create({ projectId, title: title.trim(), artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async update(req, res, next) {
    try {
      const { albumId } = req.params;
      const album = await AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });
      const { title, artist, year, genre, label } = req.body;
      res.json(await AlbumModel.update(albumId, { title, artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!(await AlbumModel.findById(albumId))) return res.status(404).json({ error: 'Album not found' });
      await AlbumModel.delete(albumId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async getTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!(await AlbumModel.findById(albumId))) return res.status(404).json({ error: 'Album not found' });
      res.json(await AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async addTrack(req, res, next) {
    try {
      const { albumId } = req.params;
      const { musicId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!(await AlbumModel.findById(albumId))) return res.status(404).json({ error: 'Album not found' });
      await AlbumModel.addTrack(albumId, musicId);
      res.status(201).json(await AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async removeTrack(req, res, next) {
    try {
      const { albumId, musicId } = req.params;
      if (!(await AlbumModel.findById(albumId))) return res.status(404).json({ error: 'Album not found' });
      await AlbumModel.removeTrack(albumId, musicId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async reorderTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      const { order } = req.body;
      if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of musicIds' });
      if (!(await AlbumModel.findById(albumId))) return res.status(404).json({ error: 'Album not found' });
      await AlbumModel.reorderTracks(albumId, order);
      res.json(await AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },
};
