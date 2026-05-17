import { VoiceService } from './voice.service.js';

export class VoiceController {
  constructor() {
    this.service = new VoiceService();
  }

  async design(req, res) {
    try {
      const { prompt, previewText, voiceId } = req.body;
      if (!prompt || !previewText) {
        return res.status(400).json({ error: 'prompt and previewText are required' });
      }
      const result = await this.service.designVoice({ prompt, previewText, voiceId });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async list(req, res) {
    try {
      const voices = await this.service.listVoices();
      res.json(voices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      const { voiceId } = req.params;
      await this.service.deleteVoice(voiceId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async clone(req, res) {
    try {
      const { projectId, name, audioFilePath } = req.body;
      if (!projectId || !name) {
        return res.status(400).json({ error: 'projectId and name are required' });
      }
      if (!audioFilePath) {
        return res.status(400).json({ error: 'audioFilePath is required' });
      }
      const result = await this.service.cloneVoice({ projectId, name, audioFilePath });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listClones(req, res) {
    try {
      const { projectId } = req.params;
      const clones = this.service.listClones(projectId);
      res.json(clones);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}