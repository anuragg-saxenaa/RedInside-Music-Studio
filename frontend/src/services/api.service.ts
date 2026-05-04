import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Projects
export const projectsApi = {
  create: (data: { name: string; description?: string; workflowMode?: string }) =>
    api.post('/projects', data).then(res => res.data),
  getAll: () => api.get('/projects').then(res => res.data),
  getById: (id: string) => api.get(`/projects/${id}`).then(res => res.data),
  update: (id: string, data: Partial<{ name: string; description: string; workflowMode: string }>) =>
    api.put(`/projects/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Lyrics
export const lyricsApi = {
  generate: (data: { projectId: string; prompt: string; stylePreset?: string; mode?: string }) =>
    api.post('/lyrics/generate', data).then(res => res.data),
  getById: (id: string) => api.get(`/lyrics/${id}`).then(res => res.data),
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/lyrics`).then(res => res.data),
  getPresets: () => api.get('/lyrics/presets').then(res => res.data),
};

// Music
export const musicApi = {
  generate: (data: { projectId: string; lyricsId?: string; prompt?: string; model?: string; isInstrumental?: boolean }) =>
    api.post('/music/generate', data).then(res => res.data),
  getById: (id: string) => api.get(`/music/${id}`).then(res => res.data),
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/music`).then(res => res.data),
};

// Jobs
export const jobsApi = {
  create: (data: { projectId: string; type: string; inputParams?: object }) =>
    api.post('/jobs', data).then(res => res.data),
  getById: (id: string) => api.get(`/jobs/${id}`).then(res => res.data),
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/jobs`).then(res => res.data),
};

export default api;