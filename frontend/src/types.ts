// Shared interfaces for RedInside Music Studio frontend

export interface Project {
  id: string;
  name: string;
  description?: string;
  workflow_mode: 'auto' | 'manual' | 'hybrid';
  current_lyrics_version: number;
  current_music_version: number;
  current_video_version: number;
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
  song_id?: string;
  song_version?: number;
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
  artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  composer?: string;
  lyrics_credit?: string;
  artwork_url?: string;
  is_instrumental: boolean;
  created_at: string;
}

export interface Album {
  id: string;
  project_id: string;
  title: string;
  artist?: string;
  year?: number;
  genre?: string;
  label?: string;
  artwork_path?: string;
  track_count?: number;
  created_at: string;
  updated_at: string;
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

export interface Playlist {
  id: string;
  name: string;
  track_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack extends MusicGeneration {
  position: number;
  added_at: string;
}

export interface MusicNote {
  id: string;
  music_id: string;
  timestamp_sec: number;
  text: string;
  created_at: string;
}

export interface MusicTags {
  bpm: number | null;
  key: string | null;
  mood: string | null;
}

export interface ShareToken {
  token: string;
  url: string;
  expiresAt: string;
}

export type V4Tab = 'sounds' | 'write' | 'album' | 'craft' | 'release' | 'downloads';