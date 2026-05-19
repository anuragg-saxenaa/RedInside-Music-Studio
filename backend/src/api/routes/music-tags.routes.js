import { MusicTagsService } from '../../modules/music/music-tags.service.js';

async function getTags(req, res, next) {
  try {
    const tags = await MusicTagsService.getTags(req.params.id);
    res.json(tags);
  } catch (e) { next(e); }
}

export const MusicTagsRoutes = [
  { method: 'get', path: '/api/music/:id/tags', handler: getTags },
];
