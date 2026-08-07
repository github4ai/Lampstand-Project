export interface Hymn {
  id: string
  title: string
  author: string
  year: number
  themes: string[]
  originalKey: string
  tempo: number
  timeSignature: string
  rightsStatus?: 'public-domain' | 'user-provided'
  sections: Array<{
    label: string
    lines: string[]
  }>
}
