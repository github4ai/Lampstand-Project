export type MediaKind = 'image' | 'audio' | 'video'

export interface MediaGenerationRequest {
  kind: MediaKind
  prompt: string
  aspectRatio?: string
  durationSeconds?: number
  audioMode?: 'speech' | 'music'
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
