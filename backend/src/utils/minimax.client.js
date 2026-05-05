// backend/src/utils/minimax.client.js
import axios from 'axios';
import fs from 'fs';
import logger from './logger.js';

class MinimaxClient {
  constructor(apiKey, baseURL = 'https://api.minimax.io') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, method = 'POST', data = null) {
    const url = `${this.baseURL}${endpoint}`;

    logger.info(`MiniMax API request: ${method} ${endpoint}`);

    try {
      const response = await axios({
        method,
        url,
        headers: this.getHeaders(),
        data,
        timeout: 180000, // 180 second timeout for music generation
      });

      logger.info(`MiniMax API response: ${response.status}`);

      // Check for API-level errors even on 200 status
      if (response.data.base_resp && response.data.base_resp.status_code !== 0) {
        const error = new Error();
        error.response = { data: response.data };
        throw this.handleError(error);
      }

      return response.data;
    } catch (error) {
      // Sanitize error before logging - don't expose headers or API keys
      logger.error('MiniMax API error:', {
        endpoint,
        status: error.response?.status,
        message: error.response?.data || error.message,
        // Don't log headers or full error object
      });
      throw this.handleError(error);
    }
  }

  handleError(error) {
    const status = error.response?.data?.base_resp?.status_code;
    const message = error.response?.data?.base_resp?.status_msg || error.message;

    const errorMap = {
      0: 'Success',
      1002: 'Rate limit exceeded',
      1004: 'Authentication failed',
      1008: 'Insufficient balance',
      1026: 'Content flagged as sensitive',
      2013: 'Invalid parameters',
      2049: 'Invalid API key',
    };

    const errorMessage = errorMap[status] || message;
    const err = new Error(errorMessage);
    err.statusCode = status;
    err.originalError = error;

    return err;
  }

  // Lyrics Generation API
  async generateLyrics(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('params must be an object');
    }
    return this.request('/v1/lyrics_generation', 'POST', params);
  }

  // Music Generation API
  async generateMusic(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('params must be an object');
    }
    return this.request('/v1/music_generation', 'POST', params);
  }

  // Video Generation API (async)
  async generateVideo(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('params must be an object');
    }
    return this.request('/v1/video_generation', 'POST', params);
  }

  async queryVideoStatus(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('taskId must be a non-empty string');
    }
    return this.request(`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, 'GET');
  }

  async retrieveFile(fileId) {
    if (!fileId || typeof fileId !== 'string') {
      throw new Error('fileId must be a non-empty string');
    }
    return this.request(`/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, 'GET');
  }

  // Image Generation
  async generateImage({ model, prompt, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer, subjectReference }) {
    const payload = { model, prompt };
    if (aspectRatio) payload.aspect_ratio = aspectRatio;
    if (width && height) { payload.width = width; payload.height = height; }
    if (responseFormat) payload.response_format = responseFormat;
    if (seed) payload.seed = seed;
    if (n) payload.n = n;
    if (promptOptimizer) payload.prompt_optimizer = promptOptimizer;
    if (subjectReference) payload.subject_reference = subjectReference;
    return this.request('/v1/image_generation', 'POST', payload);
  }

  // Voice Design
  async createVoiceDesign({ prompt, previewText, voiceId }) {
    const payload = { prompt, preview_text: previewText };
    if (voiceId) payload.voice_id = voiceId;
    return this.request('/v1/voice_design', 'POST', payload);
  }

  async getVoiceList() {
    return this.request('/v1/voice/list', 'GET');
  }

  async deleteVoice(voiceId) {
    return this.request(`/v1/voice/delete?voice_id=${voiceId}`, 'DELETE');
  }

  // Voice Clone Upload
  async uploadVoiceClone(filePath) {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('purpose', 'voice_clone');

    const response = await fetch(`${this.baseURL}/v1/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData,
    });
    return response.json();
  }
}

export default MinimaxClient;
