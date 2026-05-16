import { HistoryModel } from './history.model.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { MusicModel } from '../../database/models/music.model.js';
import { VideoModel } from '../video/video.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import logger from '../../utils/logger.js';

export class HistoryService {
  /**
   * Get all generations for a project grouped by type
   * @param {string} projectId - Project ID
   * @returns {Object} - { lyrics: [...], music: [...], video: [...], chains: [...] }
   */
  async getProjectHistory(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID is required and must be a string');
    }

    const project = ProjectModel.findById(projectId);
    if (!project) {
      const err = new Error(`Project not found: ${projectId}`);
      err.statusCode = 404;
      throw err;
    }

    logger.info('Getting project history', { projectId });
    return HistoryModel.getProjectGenerations(projectId);
  }

  /**
   * Get linked generations: lyrics → music → video
   * @param {string} generationId - Either lyrics, music, or video ID
   * @returns {Object} - { chain, lyrics, music, video }
   */
  async getVersionChain(generationId) {
    if (!generationId || typeof generationId !== 'string') {
      throw new Error('Generation ID is required and must be a string');
    }

    // Find which chain contains this generation
    let chain = HistoryModel.findByLyricsId(generationId) ||
                HistoryModel.findByMusicId(generationId) ||
                HistoryModel.findByVideoId(generationId);

    if (!chain) {
      // Generation might not be in a chain yet - find standalone generation
      const lyrics = LyricsModel.findById(generationId);
      if (lyrics) {
        return {
          chain: null,
          lyrics,
          music: null,
          video: null,
        };
      }

      const music = MusicModel.findById(generationId);
      if (music) {
        return {
          chain: null,
          lyrics: lyrics ? LyricsModel.findById(generationId) : null,
          music,
          video: null,
        };
      }

      const video = VideoModel.findById(generationId);
      if (video) {
        return {
          chain: null,
          lyrics: null,
          music: null,
          video,
        };
      }

      const err = new Error(`Generation not found: ${generationId}`);
      err.statusCode = 404;
      throw err;
    }

    // Fetch linked generations
    const result = { chain };

    if (chain.lyrics_id) {
      result.lyrics = LyricsModel.findById(chain.lyrics_id);
    }
    if (chain.music_id) {
      result.music = MusicModel.findById(chain.music_id);
    }
    if (chain.video_id) {
      result.video = VideoModel.findById(chain.video_id);
    }

    logger.info('Got version chain', { generationId, chainId: chain.id });
    return result;
  }

  /**
   * Load version settings and prepare for regeneration
   * @param {string} generationId - Generation ID (lyrics, music, or video)
   * @returns {Object} - { generation, nextVersion, type }
   */
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
      const lyrics = LyricsModel.findById(generationId);
      if (lyrics) type = 'lyrics';
    }
    if (!type) {
      const music = MusicModel.findById(generationId);
      if (music) type = 'music';
    }
    if (!type) {
      const video = VideoModel.findById(generationId);
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
      generation = LyricsModel.findById(generationId);
      if (!generation) { const err = new Error(`Lyrics not found: ${generationId}`); err.statusCode = 404; throw err; }
    } else if (type === 'music') {
      generation = MusicModel.findById(generationId);
      if (!generation) { const err = new Error(`Music not found: ${generationId}`); err.statusCode = 404; throw err; }
    } else if (type === 'video') {
      generation = VideoModel.findById(generationId);
      if (!generation) { const err = new Error(`Video not found: ${generationId}`); err.statusCode = 404; throw err; }
    }

    // Get next version number for regeneration
    let nextVersion;
    if (type === 'lyrics') {
      nextVersion = LyricsModel.getNextVersion(generation.project_id);
    } else if (type === 'music') {
      nextVersion = MusicModel.getNextVersion(generation.project_id);
    } else if (type === 'video') {
      nextVersion = VideoModel.getNextVersion(generation.project_id);
    }

    // Prepare regeneration params
    let regenerationParams = {
      projectId: generation.project_id,
      version: nextVersion,
    };

    if (type === 'lyrics') {
      regenerationParams = {
        ...regenerationParams,
        prompt: generation.prompt,
        stylePreset: generation.style_preset,
        mode: generation.mode,
      };
    } else if (type === 'music') {
      regenerationParams = {
        ...regenerationParams,
        model: generation.model,
        prompt: generation.prompt,
        lyricsId: generation.lyrics_id,
        isInstrumental: Boolean(generation.is_instrumental),
        audioSettings: generation.audio_settings,
      };
    } else if (type === 'video') {
      regenerationParams = {
        ...regenerationParams,
        model: generation.model,
        prompt: generation.prompt,
        musicId: generation.music_id,
        duration: generation.duration,
        resolution: generation.resolution,
      };
    }

    return {
      generation,
      type,
      nextVersion,
      regenerationParams,
    };
  }

  /**
   * Compare two versions of the same generation type
   * @param {string} id1 - First generation ID
   * @param {string} id2 - Second generation ID
   * @param {string} type - Generation type ('lyrics', 'music', 'video')
   * @returns {Object} - Comparison result with diff
   */
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
      gen1 = LyricsModel.findById(id1);
      gen2 = LyricsModel.findById(id2);
    } else if (type === 'music') {
      gen1 = MusicModel.findById(id1);
      gen2 = MusicModel.findById(id2);
    } else if (type === 'video') {
      gen1 = VideoModel.findById(id1);
      gen2 = VideoModel.findById(id2);
    }

    if (!gen1 || !gen2) {
      const err = new Error('One or both generations not found');
      err.statusCode = 404;
      throw err;
    }

    // Build comparison result
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

  /**
   * Simple line-by-line diff for text content
   * @param {string} text1 - Original text
   * @param {string} text2 - New text
   * @returns {Object} - { added: [...], removed: [...] }
   */
  generateTextDiff(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const added = lines2.filter(line => !lines1.includes(line));
    const removed = lines1.filter(line => !lines2.includes(line));

    return { added, removed };
  }

  /**
   * Soft delete a generation - unlink from chain and cleanup files
   * @param {string} generationId - Generation ID
   * @param {string} type - Generation type ('lyrics', 'music', 'video')
   * @returns {Object} - Deletion result
   */
  async deleteVersion(generationId, type) {
    if (!generationId || typeof generationId !== 'string') {
      throw new Error('Generation ID is required and must be a string');
    }

    const validTypes = ['lyrics', 'music', 'video'];
    if (!type || !validTypes.includes(type)) {
      throw new Error(`Type is required and must be one of: ${validTypes.join(', ')}`);
    }

    logger.info('Deleting version', { generationId, type });

    // Find and unlink from chain
    let chain = HistoryModel.findByLyricsId(generationId) ||
                HistoryModel.findByMusicId(generationId) ||
                HistoryModel.findByVideoId(generationId);

    if (chain) {
      const updateData = {};
      if (type === 'lyrics') updateData.lyricsId = null;
      else if (type === 'music') updateData.musicId = null;
      else if (type === 'video') updateData.videoId = null;
      HistoryModel.update(chain.id, updateData);
    }

    // Note: We don't actually delete the generation record or files
    // The generation remains accessible but is unlinked from chains
    // This preserves the ability to recover if needed

    return {
      success: true,
      message: `Version ${type}/${generationId} unlinked from chain`,
      generationId,
      type,
    };
  }

  /**
   * Link generations into a chain (called after generation completes)
   * @param {string} projectId - Project ID
   * @param {Object} generation - { type, id }
   * @returns {Object} - Updated or new chain
   */
  async linkGeneration(projectId, generation) {
    if (!projectId || !generation || !generation.type || !generation.id) {
      throw new Error('Project ID, generation type, and ID are required');
    }

    logger.info('Linking generation to chain', { projectId, generation });

    // Find existing chain that has this type's ID as null
    let chain = null;

    if (generation.type === 'lyrics') {
      // Look for chain with no lyrics yet
      const chains = HistoryModel.findByProject(projectId);
      chain = chains.find(c => !c.lyrics_id);
    } else if (generation.type === 'music') {
      // Look for chain with lyrics but no music
      const chains = HistoryModel.findByProject(projectId);
      chain = chains.find(c => c.lyrics_id && !c.music_id);
    } else if (generation.type === 'video') {
      // Look for chain with music but no video
      const chains = HistoryModel.findByProject(projectId);
      chain = chains.find(c => c.music_id && !c.video_id);
    }

    // If no suitable chain found, create new one
    if (!chain) {
      const newChain = HistoryModel.create({ projectId });
      chain = newChain;
    }

    // Update chain with this generation
    const updateData = {};
    if (generation.type === 'lyrics') updateData.lyricsId = generation.id;
    else if (generation.type === 'music') updateData.musicId = generation.id;
    else if (generation.type === 'video') updateData.videoId = generation.id;

    return HistoryModel.update(chain.id, updateData);
  }
}

export default new HistoryService();