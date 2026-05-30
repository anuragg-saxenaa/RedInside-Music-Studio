import { MusicNotesModel } from './music-notes.model.js';

export const MusicNotesController = {
  async list(req, res, next) {
    try {
      res.json(await MusicNotesModel.findByMusic(req.params.id));
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { timestamp_sec, text } = req.body;
      if (timestamp_sec == null || !text?.trim()) {
        return res.status(400).json({ error: 'timestamp_sec and text are required' });
      }
      res.status(201).json(
        await MusicNotesModel.create(req.params.id, Number(timestamp_sec), text.trim())
      );
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      await MusicNotesModel.delete(req.params.noteId);
      res.status(204).end();
    } catch (e) { next(e); }
  },
};
