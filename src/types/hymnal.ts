export interface Hymn {
  id: string
  title: string
  catalogPrefix?: string
  hymnNumber?: string
  author: string
  language?: string
  year: number
  themes: string[]
  category?: string
  subcategory?: string
  scriptures?: string[]
  lyricist?: string
  composer?: string
  hymnCode?: string
  originalKey: string
  tempo: number
  timeSignature: string
  rightsStatus?: 'public-domain' | 'user-provided' | 'local-library'
  audioUrl?: string
  pianoSheetUrl?: string
  guitarSheetUrl?: string
  textSheetUrl?: string
  singingAudioUrl?: string
  fullAudioUrl?: string
  midiUrl?: string
  tuneMidiUrl?: string
  sourceUrl?: string
  sourcePath?: string
  relatedCatalogs?: string[]
  tune?: { bpm: number; notes: Array<{ midi: number; beats: number }> }
  sections: Array<{
    label: string
    lines: string[]
  }>
}
