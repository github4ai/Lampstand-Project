export interface Hymn {
  id: string
  title: string
  catalogPrefix?: string
  hymnNumber?: string
  author: string
  year: number
  themes: string[]
  category?: string
  scriptures?: string[]
  originalKey: string
  tempo: number
  timeSignature: string
  rightsStatus?: 'public-domain' | 'user-provided'
  audioUrl?: string
  pianoSheetUrl?: string
  tune?: { bpm: number; notes: Array<{ midi: number; beats: number }> }
  sections: Array<{
    label: string
    lines: string[]
  }>
}
