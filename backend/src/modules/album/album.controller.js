import { AlbumModel } from './album.model.js';

export const AlbumController = {
  async list(req, res, next) {
    try {
      const { id: projectId } = req.params;
      res.json(AlbumModel.findByProject(projectId));
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { id: projectId } = req.params;
      const { title, artist, year, genre, label } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
      res.status(201).json(AlbumModel.create({ projectId, title: title.trim(), artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async update(req, res, next) {
    try {
      const { albumId } = req.params;
      const album = AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });
      const { title, artist, year, genre, label } = req.body;
      res.json(AlbumModel.update(albumId, { title, artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.delete(albumId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async getTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      res.json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async addTrack(req, res, next) {
    try {
      const { albumId } = req.params;
      const { musicId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.addTrack(albumId, musicId);
      res.status(201).json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async removeTrack(req, res, next) {
    try {
      const { albumId, musicId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.removeTrack(albumId, musicId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async reorderTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      const { order } = req.body;
      if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of musicIds' });
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.reorderTracks(albumId, order);
      res.json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },
};
