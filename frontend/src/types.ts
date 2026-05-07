// Shared interfaces for RedInside Music Studio frontend

export interface Project {
  id: string;
  name: string;
  description?: string;
  workflow_mode: 'auto' | 'manual' | 'hybrid';
  current_lyrics_version: number;
  current_music_version: number;
  created_at: string;
  updated_at: string;
}

export interface LyricsGeneration {
  id: string;
  project_id: string;
  version: number;
  content: string;
  title?: string;
  style_preset?: string;
  created_at: string;
}

export interface MusicGeneration {
  id: string;
  project_id: string;
  lyrics_id?: string;
  version: number;
  model: string;
  original_file_path?: string;
  processed_file_path?: string;
  duration_seconds?: number;
  bitrate?: number;
  title?: string;
  created_at: string;
}

export interface VideoGeneration {
  id: string;
  project_id: string;
  music_id?: string;
  lyrics_id?: string;
  version: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  model?: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
  file_id?: string;
  error_message?: string;
  completed_at?: string;
  created_at: string;
}

export interface GenerationChain {
  id: string;
  project_id: string;
  lyrics_id?: string;
  music_id?: string;
  video_id?: string;
  created_at: string;
}

export interface HistoryData {
  lyrics: LyricsGeneration[];
  music: MusicGeneration[];
  video: VideoGeneration[];
  chains: GenerationChain[];
}

export interface CompareResult {
  type: string;
  versions: {
    v1: { id: string; version: number; createdAt: string };
    v2: { id: string; version: number; createdAt: string };
  };
  differences: Record<string, boolean>;
  contentDiff?: { added: string[]; removed: string[] };
}

export interface ReplayData {
  generation: LyricsGeneration | MusicGeneration | VideoGeneration;
  type: string;
  nextVersion: number;
  regenerationParams: Record<string, string | number | boolean>;
}