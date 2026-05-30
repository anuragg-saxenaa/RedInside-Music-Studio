import * as MinimaxClientModule from '../../utils/minimax.client.js';
import config from '../../config/env.config.js';
import db from '../../database/connection.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

const MinimaxClient = MinimaxClientModule.default;

export class VoiceService {
  constructor() {
    this.minimax = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async designVoice({ prompt, previewText, voiceId }) {
    const result = await this.minimax.createVoiceDesign({ prompt, previewText, voiceId });
    if (result.base_resp.status_code !== 0) {
      throw new Error(result.base_resp.status_msg || 'Voice design failed');
    }
    return {
      voiceId: result.voice_id,
      trialAudio: result.trial_audio,
    };
  }

  async listVoices() {
    const result = await this.minimax.getVoiceList();
    return result.data?.voices || result.voices || [];
  }

  async deleteVoice(voiceId) {
    const result = await this.minimax.deleteVoice(voiceId);
    return result.base_resp.status_code === 0;
  }

  async cloneVoice({ projectId, name, audioFilePath }) {
    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      throw new Error('audioFilePath is required and must exist on disk');
    }

    // Upload audio to MiniMax for voice cloning
    const uploadResult = await this.minimax.uploadVoiceClone(audioFilePath);
    if (!uploadResult.file?.file_id) {
      throw new Error('Voice clone upload failed: no file_id returned');
    }

    const fileId = uploadResult.file.file_id;
    const id = nanoid();

    // Persist to voice_clones table
    await db.execute({
      sql: `INSERT INTO voice_clones (id, project_id, name, file_id, filename, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [id, projectId, name, fileId, path.basename(audioFilePath)],
    });

    return { id, projectId, name, voiceId: fileId };
  }

  async listClones(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM voice_clones WHERE project_id = ? ORDER BY created_at DESC', args: [projectId] });
    return result.rows;
  }
}
