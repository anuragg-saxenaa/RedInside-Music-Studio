import * as MinimaxClientModule from '../../utils/minimax.client.js';
import config from '../../config/env.config.js';
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
    return result.data?.voices || [];
  }

  async deleteVoice(voiceId) {
    const result = await this.minimax.deleteVoice(voiceId);
    return result.base_resp.status_code === 0;
  }

  async cloneVoice({ projectId, name, audioUrl }) {
    return {
      id: Date.now(),
      projectId,
      name,
      voiceId: audioUrl,
    };
  }
}