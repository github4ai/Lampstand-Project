import type { Hymn } from '../types/hymnal'
import { stripChords } from './chords'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', zh: 'Chinese', ta: 'Tamil', hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ml: 'Malayalam' }
export type BrowseField = 'all' | 'number' | 'category' | 'language' | 'scripture' | 'first-line'

export function firstLyricLine(hymn: Hymn) {
  return hymn.sections.flatMap((section) => section.lines).map(stripChords).find((line) => line.trim())?.trim() ?? ''
}

export function matchesBrowseField(hymn: Hymn, term: string, field: BrowseField) {
  if (!term) return true
  const number = `${hymn.catalogPrefix ?? ''}${hymn.hymnNumber ?? ''}`
  const values: Record<BrowseField, string[]> = {
    all: [hymn.title, hymn.author, number, hymn.category ?? '', hymn.subcategory ?? '',
      LANGUAGE_NAMES[hymn.language ?? 'en'] ?? hymn.language ?? '', ...(hymn.scriptures ?? []), firstLyricLine(hymn), ...hymn.themes],
    number: [number, hymn.catalogPrefix ?? '', hymn.hymnNumber ?? ''],
    category: [hymn.category ?? '', hymn.subcategory ?? '', ...hymn.themes],
    language: [LANGUAGE_NAMES[hymn.language ?? 'en'] ?? hymn.language ?? '', hymn.language ?? ''],
    scripture: hymn.scriptures ?? [],
    'first-line': [firstLyricLine(hymn)],
  }
  return values[field].some((value) => value.toLowerCase().includes(term))
}

export function matchesCatalogSearch(hymn: Hymn, term: string) {
  if (!term) return true
  const values = [
    `${hymn.catalogPrefix ?? ''} ${hymn.hymnNumber ?? ''}`,
    hymn.category ?? '', hymn.subcategory ?? '',
    LANGUAGE_NAMES[hymn.language ?? 'en'] ?? hymn.language ?? '', hymn.language ?? '',
    ...(hymn.scriptures ?? []), firstLyricLine(hymn),
  ]
  return values.some((value) => value.toLowerCase().includes(term.toLowerCase()))
}

export function matchesHymnCollection(hymn: Hymn, collection: string) {
  if (collection === 'all') return true
  const prefix = hymn.catalogPrefix?.toUpperCase()
  if (collection !== 'H') return prefix === collection
  const sourcePath = hymn.sourcePath?.replace(/\\/g, '/').toLowerCase() ?? ''
  return prefix === 'H' || sourcePath.includes('/hymn/h/')
}
