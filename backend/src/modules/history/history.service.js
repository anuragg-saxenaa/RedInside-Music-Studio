import { HistoryModel } from './history.model.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { MusicModel } from '../../database/models/music.model.js';
import { VideoModel } from '../video/video.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import logger from '../../utils/logger.js';

export class HistoryService {
  async getProjectHistory(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID is required and must be a string');
    }

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      const err = new Error(`Project not found: ${projectId}`);
      err.statusCode = 404;
      throw err;
    }

    logger.info('Getting project history', { projectId });
    return HistoryModel.getProjectGenerations(projectId);
  }

  async getVersionChain(generationId) {
    if (!generationId || typeof generationId !== 'string') {
      throw new Error('Generation ID is required and must be a string');
    }

    let chain = await HistoryModel.findById(generationId) ||
                await HistoryModel.findByLyricsId(generationId) ||
                await HistoryModel.findByMusicId(generationId) ||
                await HistoryModel.findByVideoId(generationId);

    if (!chain) {
      const lyrics = await LyricsModel.findById(generationId);
      if (lyrics) {
        return { chain: null, lyrics, music: null, video: null };
      }

      const music = await MusicModel.findById(generationId);
      if (music) {
        return { chain: null, lyrics: null, music, video: null };
      }

      const video = await VideoModel.findById(generationId);
      if (video) {
        return { chain: null, lyrics: null, music: null, video };
      }

      const err = new Error(`Generation not found: ${generationId}`);
      err.statusCode = 404;
      throw err;
    }

    const result = { chain };

    if (chain.lyrics_id) {
      result.lyrics = await LyricsModel.findById(chain.lyrics_id);
    }
    if (chain.music_id) {
      result.music = await MusicModel.findById(chain.music_id);
    }
    if (chain.video_id) {
      result.video = await VideoModel.findById(chain.video_id);
    }

    logger.info('Got version chain', { generationId, chainId: chain.id });
    return result;
  }

  async replayVersion(generationId, type) {
    if (!generationId || typeof generationId !== 'string') {
      throw new Error('Generation ID is required and must be a string');
    }

    const validTypes = ['lyrics', 'music', 'video'];
    if (type && !validTypes.includes(type)) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Determine type if not provided
    if (!type) {
      const lyrics = await LyricsModel.findById(generationId);
      if (lyrics) type = 'lyrics';
    }
    if (!type) {
      const music = await MusicModel.findById(generationId);
      if (music) type = 'music';
    }
    if (!type) {
      const video = await VideoModel.findById(generationId);
      if (video) type = 'video';
    }

    if (!type) {
      const err = new Error(`Generation not found: ${generationId}`);
      err.statusCode = 404;
      throw err;
    }

    logger.info('Replaying version', { generationId, type });

    let generation;
    if (type === 'lyrics') {
      generation = await LyricsModel.findById(generationId);
      if (!generation) { const err = new Error(`Lyrics not found: ${generationId}`); err.statusCode = 404; throw err; }
    } else if (type === 'music') {
      generation = await MusicModel.findById(generationId);
      if (!generation) { const err = new Error(`Music not found: ${generationId}`); err.statusCode = 404; throw err; }
    } else if (type === 'video') {
      generation = await VideoModel.findById(generationId);
      if (!generation) { const err = new Error(`Video not found: ${generationId}`); err.statusCode = 404; throw err; }
    }

    // Get next version number for regeneration
    let nextVersion;
    if (type === 'lyrics') {
      nextVersion = await LyricsModel.getNextVersion(generation.project_id);
    } else if (type === 'music') {
      nextVersion = await MusicModel.getNextVersion(generation.project_id);
    } else if (type === 'video') {
      nextVersion = await VideoModel.getNextVersion(generation.project_id);
    }

    let regenerationParams = { projectId: generation.project_id, version: nextVersion };

    if (type === 'lyrics') {
      regenerationParams = { ...regenerationParams, prompt: generation.prompt, stylePreset: generation.style_preset, mode: generation.mode };
    } else if (type === 'music') {
      regenerationParams = { ...regenerationParams, model: generation.model, prompt: generation.prompt, lyricsId: generation.lyrics_id, isInstrumental: Boolean(generation.is_instrumental), audioSettings: generation.audio_settings };
    } else if (type === 'video') {
      regenerationParams = { ...regenerationParams, model: generation.model, prompt: generation.prompt, musicId: generation.music_id, duration: generation.duration, resolution: generation.resolution };
    }

    return { generation, type, nextVersion, regenerationParams };
  }

  async compareVersions(id1, id2, type) {
    if (!id1 || !id2 || typeof id1 !== 'string' || typeof id2 !== 'string') {
      throw new Error('Two generation IDs are required');
    }

    const validTypes = ['lyrics', 'music', 'video'];
    if (!type || !validTypes.includes(type)) {
      throw new Error(`Type is required and must be one of: ${validTypes.join(', ')}`);
    }

    logger.info('Comparing versions', { id1, id2, type });

    let gen1, gen2;

    if (type === 'lyrics') {
      [gen1, gen2] = await Promise.all([LyricsModel.findById(id1), LyricsModel.findById(id2)]);
    } else if (type === 'music') {
      [gen1, gen2] = await Promise.all([MusicModel.findById(id1), MusicModel.findById(id2)]);
    } else if (type === 'video') {
      [gen1, gen2] = await Promise.all([VideoModel.findById(id1), VideoModel.findById(id2)]);
    }

    if (!gen1 || !gen2) {
      const err = new Error('One or both generations not found');
      err.statusCode = 404;
      throw err;
    }

    const comparison = {
      type,
      versions: {
        v1: { id: gen1.id, version: gen1.version, createdAt: gen1.created_at },
        v2: { id: gen2.id, version: gen2.version, createdAt: gen2.created_at },
      },
      differences: {},
    };

    if (type === 'lyrics') {
      comparison.differences = {
        title: gen1.title !== gen2.title,
        content: gen1.content !== gen2.content,
        stylePreset: gen1.style_preset !== gen2.style_preset,
        styleTags: gen1.style_tags !== gen2.style_tags,
      };
      comparison.contentDiff = this.generateTextDiff(gen1.content, gen2.content);
    } else if (type === 'music') {
      comparison.differences = {
        model: gen1.model !== gen2.model,
        prompt: gen1.prompt !== gen2.prompt,
        isInstrumental: gen1.is_instrumental !== gen2.is_instrumental,
        duration: gen1.duration_seconds !== gen2.duration_seconds,
      };
    } else if (type === 'video') {
      comparison.differences = {
        model: gen1.model !== gen2.model,
        prompt: gen1.prompt !== gen2.prompt,
        duration: gen1.duration !== gen2.duration,
        resolution: gen1.resolution !== gen2.resolution,
      };
    }

    return comparison;
  }

  generateTextDiff(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const added = lines2.filter(line => !lines1.includes(line));
    const removed = lines1.filter(line => !lines2.includes(line));
    return { added, removed };
  }

  async deleteVersion(generationId, type) {
    if (!generationId || typeof generationId !== 'string') {
      throw new Error('Generation ID is required and must be a string');
    }

    const validTypes = ['lyrics', 'music', 'video'];
    if (!type || !validTypes.includes(type)) {
      throw new Error(`Type is required and must be one of: ${validTypes.join(', ')}`);
    }

    logger.info('Deleting version', { generationId, type });

    const chain = await HistoryModel.findByLyricsId(generationId) ||
                  await HistoryModel.findByMusicId(generationId) ||
                  await HistoryModel.findByVideoId(generationId);

    if (chain) {
      const updateData = {};
      if (type === 'lyrics') updateData.lyricsId = null;
      else if (type === 'music') updateData.musicId = null;
      else if (type === 'video') updateData.videoId = null;
      await HistoryModel.update(chain.id, updateData);
    }

    return {
      success: true,
      message: `Version ${type}/${generationId} unlinked from chain`,
      generationId,
      type,
    };
  }

  async linkGeneration(projectId, generation) {
    if (!projectId || !generation || !generation.type || !generation.id) {
      throw new Error('Project ID, generation type, and ID are required');
    }

    logger.info('Linking generation to chain', { projectId, generation });

    let chain = null;

    if (generation.type === 'lyrics') {
      const chains = await HistoryModel.findByProject(projectId);
      chain = chains.find(c => !c.lyrics_id);
    } else if (generation.type === 'music') {
      const chains = await HistoryModel.findByProject(projectId);
      chain = chains.find(c => c.lyrics_id && !c.music_id);
    } else if (generation.type === 'video') {
      const chains = await HistoryModel.findByProject(projectId);
      chain = chains.find(c => c.music_id && !c.video_id);
    }

    if (!chain) {
      chain = await HistoryModel.create({ projectId });
    }

    const updateData = {};
    if (generation.type === 'lyrics') updateData.lyricsId = generation.id;
    else if (generation.type === 'music') updateData.musicId = generation.id;
    else if (generation.type === 'video') updateData.videoId = generation.id;

    return HistoryModel.update(chain.id, updateData);
  }
}

export default new HistoryService();
