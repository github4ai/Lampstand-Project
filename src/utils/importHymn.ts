import type { Hymn } from '../types/hymnal'

export function parseHymnImport(text: string, filename: string): Hymn | null {
  return filename.toLowerCase().endsWith('.json')
    ? parseJsonHymn(text)
    : parseChordProHymn(text)
}

function parseJsonHymn(text: string): Hymn | null {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null
    const hymn = value as Partial<Hymn>
    if (typeof hymn.title !== 'string' || !Array.isArray(hymn.sections)) return null
    if (!hymn.sections.every((section) => typeof section?.label === 'string' &&
      Array.isArray(section.lines) && section.lines.every((line) => typeof line === 'string'))) return null
    return normalizeHymn(hymn)
  } catch { return null }
}

function parseChordProHymn(text: string): Hymn | null {
  const metadata = new Map<string, string>()
  const sections: Hymn['sections'] = []
  let current = { label: 'Verse 1', lines: [] as string[] }
  for (const rawLine of text.split(/\r?\n/)) {
    const directive = rawLine.match(/^\{([^:}]+)(?::\s*(.*))?\}$/)
    if (directive) {
      const name = directive[1].toLowerCase()
      const value = directive[2]?.trim() ?? ''
      if (name === 'comment' || name === 'c' || name === 'start_of_chorus' || name === 'soc') {
        if (current.lines.length) sections.push(current)
        current = { label: value || 'Chorus', lines: [] }
      } else if (name !== 'end_of_chorus' && name !== 'eoc') metadata.set(name, value)
    } else if (rawLine.trim()) current.lines.push(rawLine)
  }
  if (current.lines.length) sections.push(current)
  const title = metadata.get('title') ?? metadata.get('t')
  if (!title || sections.length === 0) return null
  return normalizeHymn({ title, author: metadata.get('artist') ?? metadata.get('a'),
    originalKey: metadata.get('key'), tempo: Number(metadata.get('tempo')),
    timeSignature: metadata.get('time'), themes: metadata.get('theme')?.split(','),
    category: metadata.get('category'), scriptures: metadata.get('scripture')?.split(','), sections })
}

function normalizeHymn(value: Partial<Hymn>): Hymn {
  return { id: crypto.randomUUID(), title: value.title?.trim() || 'Imported hymn',
    author: value.author?.trim() || 'Unknown', year: Number.isFinite(value.year) ? value.year as number : 0,
    themes: value.themes?.filter((theme): theme is string => typeof theme === 'string').map((theme) => theme.trim()).filter(Boolean) ?? [],
    category: typeof value.category === 'string' ? value.category.trim() : undefined,
    scriptures: value.scriptures?.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean),
    originalKey: typeof value.originalKey === 'string' ? value.originalKey : 'C',
    tempo: Number.isFinite(value.tempo) ? value.tempo as number : 80,
    timeSignature: typeof value.timeSignature === 'string' ? value.timeSignature : '4/4',
    rightsStatus: 'user-provided',
    audioUrl: typeof value.audioUrl === 'string' ? value.audioUrl : undefined,
    pianoSheetUrl: typeof value.pianoSheetUrl === 'string' ? value.pianoSheetUrl : undefined,
    tune: value.tune, sections: value.sections ?? [] }
}
