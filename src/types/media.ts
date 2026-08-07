export type MediaKind = 'image' | 'audio' | 'video'

export interface MediaGenerationRequest {
  kind: MediaKind
  prompt: string
  aspectRatio?: string
  durationSeconds?: number
  audioMode?: 'speech' | 'music' | 'instrumental' | 'song'
  language?: string
  genre?: string
  audioStyle?: string
  imageMode?: 'sermon_illustration' | 'social_post' | 'thumbnail' | 'poster' | 'background'
  videoMode?: 'text_to_video' | 'lyric_video' | 'sermon_clip' | 'scripture_animation'
  visualStyle?: string
  quality?: 'draft' | 'standard' | 'high'
  resolution?: '720p' | '1080p' | '4k'
}

export interface MediaGeneration {
  id: string
  kind: MediaKind
  status: 'queued' | 'processing' | 'completed' | 'failed'
  prompt: string
  url?: string
  createdAt: string
  error?: string
}
