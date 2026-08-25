import { describe, expect, it } from 'vitest'
import type { Hymn } from '../types/hymnal'
import { firstLyricLine, matchesBrowseField, matchesHymnCollection } from '../utils/hymnBrowse'

const hymn: Hymn = {
  id: 'ns-1156', title: 'Blending is the Way', catalogPrefix: 'NS', hymnNumber: '1156',
  author: 'L. M.', language: 'en', year: 0, themes: ['Her Building'], category: 'The Church',
  scriptures: ['1 Corinthians 12:24'], originalKey: 'F', tempo: 96, timeSignature: '4/4',
  sections: [{ label: 'Verse 1', lines: ['[D]We have come from many [A]places,', 'Different faces'] }],
}

describe('Hymnal browsing fields', () => {
  it('extracts a first lyric line without chords', () => {
    expect(firstLyricLine(hymn)).toBe('We have come from many places,')
  })

  it.each([
    ['number', 'ns1156'], ['category', 'church'], ['language', 'english'],
    ['scripture', 'corinthians 12'], ['first-line', 'come from many'],
  ] as const)('matches %s searches', (field, query) => {
    expect(matchesBrowseField(hymn, query, field)).toBe(true)
  })

  it('does not match unrelated scripture text', () => {
    expect(matchesBrowseField(hymn, 'John 3:16', 'scripture')).toBe(false)
  })

  it('includes E-labeled hymns imported from the Classic h collection', () => {
    expect(matchesHymnCollection({ ...hymn, catalogPrefix: 'E', sourcePath: 'en\\hymn\\h\\1127.html' }, 'H')).toBe(true)
  })

  it('keeps non-Classic collections separated', () => {
    expect(matchesHymnCollection(hymn, 'H')).toBe(false)
    expect(matchesHymnCollection(hymn, 'NS')).toBe(true)
  })
})
