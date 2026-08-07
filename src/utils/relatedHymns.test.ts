import { describe, expect, it } from 'vitest'
import type { Hymn } from '../types/hymnal'
import { getRelatedHymns } from './relatedHymns'

function hymn(id: string, themes: string[], category?: string): Hymn {
  return { id, title: id, author: 'Test', year: 0, themes, category,
    originalKey: 'C', tempo: 80, timeSignature: '4/4', sections: [] }
}

describe('getRelatedHymns', () => {
  it('ranks shared themes and excludes the selected hymn', () => {
    const selected = hymn('selected', ['Grace', 'Praise'], 'Worship')
    const result = getRelatedHymns(selected, [
      selected, hymn('one-theme', ['Grace']),
      hymn('two-themes', ['Praise', 'Grace']), hymn('unrelated', ['Prayer']),
    ])
    expect(result.map((item) => item.id)).toEqual(['two-themes', 'one-theme'])
  })
})
