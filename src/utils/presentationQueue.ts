import type { MediaSlideSource } from './mediaSlide'

export type StudioSourceKind = 'bible' | 'hymnal' | 'hwmr' | 'ministry' | 'custom' | 'media' | 'deck' | 'announcement' | 'web'

/**
 * One shape for everything the studio can put on the audience screen: a slide keeps its HTML,
 * a web page keeps its URL, and media keeps its source so the console can drive transport later.
 */
export type StudioQueueItem = {
  id: string
  kind: StudioSourceKind
  title: string
  subtitle: string
  html: string
  notes: string
  url?: string
  media?: MediaSlideSource
}

export type NewQueueItem = Omit<StudioQueueItem, 'id'>
