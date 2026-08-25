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
  imageResolution?: 'high' | 'ultra' | '2k' | '4k' | '8k'
  videoMode?: 'text_to_video' | 'lyric_video' | 'sermon_clip' | 'scripture_animation'
  visualStyle?: string
  quality?: 'draft' | 'standard' | 'high' | 'ultra'
  resolution?: '720p' | '1080p' | '2k' | '4k' | '8k'
  project?: string
}

export interface MediaGeneration {
  id: string
  kind: MediaKind
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  prompt: string
  url?: string
  createdAt: string
  error?: string
  progress?: number
  favorite?: boolean
  project?: string
  settings?: Record<string, string | number | boolean | undefined>
}

export interface MediaProviderStatus {
  providers: {
    comfy: { configured: boolean; available: boolean }
    aceStep: { configured: boolean; available: boolean }
    speech: { configured: boolean; available: boolean }
    wan: { configured: boolean; available: boolean }
  }
}
