import { describe, expect, it } from 'vitest'
import hwmrLibrary from '../../data/hwmr-library.json'
import { linkBibleReferences } from './bibleReferences'

describe('linkBibleReferences', () => {
  it('inherits book and chapter across grouped verse references', () => {
    const references = linkBibleReferences('In Revelation 2 and 3 (2:1, 8, 12, 18; 3:1, 7, 14).').filter((segment) => segment.type === 'reference')
    expect(references.map(({ bookSlug, chapter, verse }) => [bookSlug, chapter, verse])).toEqual([
      ['revelation', 2, 1], ['revelation', 2, 8], ['revelation', 2, 12], ['revelation', 2, 18],
      ['revelation', 3, 1], ['revelation', 3, 7], ['revelation', 3, 14],
    ])
  })

  it('uses the surrounding paragraph book for an abbreviated reference', () => {
    const references = linkBibleReferences('The seven Spirits in Revelation are shown in 5:6.').filter((segment) => segment.type === 'reference')
    expect(references[0]).toMatchObject({ bookSlug: 'revelation', chapter: 5, verse: 6 })
  })

  it('uses a supplied book context across paragraph boundaries', () => {
    const references = linkBibleReferences('The eyes of the Lord (5:6).', 'revelation').filter((segment) => segment.type === 'reference')
    expect(references[0]).toMatchObject({ bookSlug: 'revelation', chapter: 5, verse: 6 })
  })

  it('resolves every imported HWMR Morning Nourishment reference', () => {
    const failures: string[] = []
    for (const book of hwmrLibrary.books) {
      for (const week of book.weeks) {
        for (const day of week.days) {
          for (const verse of day.morningVerses) {
            const references = linkBibleReferences(verse.reference).filter((segment) => segment.type === 'reference')
            if (references.length !== 1 || !references[0].bookSlug || references[0].label !== verse.reference) {
              failures.push(`${book.id} / Week ${week.number} / Day ${day.day}: ${verse.reference}`)
            }
          }
        }
      }
    }
    expect(failures).toEqual([])
  })
})
