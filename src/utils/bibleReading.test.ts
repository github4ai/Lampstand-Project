import { describe, expect, it } from 'vitest'
import { formatVerseReading } from './bibleReading'

describe('formatVerseReading', () => {
  it('announces one reference and groups consecutive verses', () => {
    expect(formatVerseReading('John', 3, [
      { number: 1, text: 'First.' }, { number: 2, text: 'Second.' }, { number: 4, text: 'Fourth.' },
    ])).toBe('John, chapter 3. Verses 1 through 2. First. Second. Verse 4. Fourth.')
  })
})
