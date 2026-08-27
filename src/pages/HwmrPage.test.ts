import { describe, expect, it } from 'vitest'
import type { MinistryBookSummary } from '../api/ministryBooks'
import { parseFurtherReadingReferences } from './HwmrPage'

const books: MinistryBookSummary[] = [
  { id: 'elders', title: "Elders' Training, Book 04: Other Crucial Matters Concerning the Practice of the Lord's Recovery", author: 'Witness Lee', chapters: 10, firstChapter: 1, lastChapter: 10 },
  { id: 'conclusion', title: 'Conclusion of the New Testament, The (Msgs. 401-420)', author: 'Witness Lee', chapters: 20, firstChapter: 1, lastChapter: 20 },
  { id: 'revelation', title: 'Life-study of Revelation', author: 'Witness Lee', chapters: 68, firstChapter: 1, lastChapter: 68 },
  { id: 'cwwn', title: 'Collected Works of Watchman Nee, The (Set 3) Vol. 50: Messages for Building Up New Believers (3)', author: 'Watchman Nee', chapters: 50, firstChapter: 1, lastChapter: 50 },
]

describe('HWMR further-reading links', () => {
  it('resolves CWW chapters, messages, and Life-study messages while ignoring page numbers as destinations', () => {
    const text = [
      'Further Reading: CWWL, 1984, vol. 2, “Elders’ Training, Book 4: Other Crucial Matters concerning the Practice of the Lord’s Recovery,” ch. 5',
      'Further Reading: The Conclusion of the New Testament, msg. 414; Life-study of Revelation, msg. 10',
      'Further Reading: CWWN, vol. 50, “Messages for Building Up New Believers (3),” ch. 45',
    ].join('\n')
    const resolved = parseFurtherReadingReferences(text, books).map(({ book, section, sectionKind }) => [book.id, section, sectionKind])
    expect(resolved).toEqual([
      ['elders', 5, 'chapter'], ['conclusion', 414, 'message'], ['revelation', 10, 'message'], ['cwwn', 45, 'chapter'],
    ])
  })
})
