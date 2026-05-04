// backend/src/utils/minimax.client.js
import axios from 'axios';
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
      });

      logger.info(`MiniMax API response: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error('MiniMax API error:', {
        endpoint,
        status: error.response?.status,
        message: error.response?.data || error.message,
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
    return this.request('/v1/lyrics_generation', 'POST', params);
  }

  // Music Generation API
  async generateMusic(params) {
    return this.request('/v1/music_generation', 'POST', params);
  }

  // Video Generation API (async)
  async generateVideo(params) {
    return this.request('/v1/video_generation', 'POST', params);
  }

  async queryVideoStatus(taskId) {
    return this.request(`/v1/query/video_generation?task_id=${taskId}`, 'GET');
  }

  async retrieveFile(fileId) {
    return this.request(`/v1/files/retrieve?file_id=${fileId}`, 'GET');
  }
}

export default MinimaxClient;
