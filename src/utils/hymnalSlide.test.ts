import { describe, expect, it } from 'vitest'
import { arrangeHymnChorus, hymnKeyFrom, hymnLayoutFor, hymnLineToHtml, hymnSectionLabel, hymnSlideHtml } from './hymnalSlide'

const sections = [
  { label: 'Verse 1', lines: ['[C]Sing out', '[G]Amen'] },
  { label: 'Chorus', lines: ['[F]Holy'] },
]

const printed = [
  { label: 'Verse 1', lines: ['first'] },
  { label: 'Chorus', lines: ['refrain'] },
  { label: 'Verse 2', lines: ['second'] },
  { label: 'Chorus 2', lines: ['refrain'] },
  { label: 'Verse 3', lines: ['third'] },
  { label: 'Chorus 3', lines: ['refrain'] },
]

const longLines = [{ label: 'Verse 1', lines: Array.from({ length: 12 }, () => 'x'.repeat(110)) }]

describe('hymnal audience slides', () => {
  it('projects lyrics without chord markers in text-only mode', () => {
    expect(hymnLineToHtml('[C]Sing [G7]out', 'text')).toBe('<p>Sing out</p>')
    expect(hymnLineToHtml('(C)Sing (G7)out', 'text')).toBe('<p>Sing out</p>')
  })

  it('keeps a lyric aside that is not a chord', () => {
    expect(hymnLineToHtml('(Ref) Sing out', 'text')).toBe('<p>(Ref) Sing out</p>')
  })

  it('hangs each chord over the next word without splitting it', () => {
    expect(hymnLineToHtml('[C]Sing out', 'chords'))
      .toBe('<p><span class="hymn-chord-slot">Sing<span class="hymn-chord">C</span></span> out</p>')
    expect(hymnLineToHtml('[C]Sing [G7]out', 'chords')).toContain('>out<span class="hymn-chord">G7')
    expect(hymnLineToHtml('[C]Sing out', 'chords')).not.toContain('[C]')
  })

  it('escapes lyric and chord text', () => {
    expect(hymnLineToHtml('[C]Sing & <shout>', 'text')).toBe('<p>Sing &amp; &lt;shout&gt;</p>')
    expect(hymnLineToHtml('[A<b]Sing', 'chords')).toContain('&lt;b')
  })

  it('numbers stanzas instead of spelling Verse out', () => {
    expect(hymnSectionLabel('Verse 1')).toBe('1')
    expect(hymnSectionLabel('Stanza 12')).toBe('12')
    expect(hymnSectionLabel('Chorus 2')).toBe('Chorus 2')
    expect(hymnSectionLabel('Doxology')).toBe('Doxology')
    expect(hymnSlideHtml(sections)).toContain('<section><h3>1</h3><p>Sing out</p><p>Amen</p></section><section><h3>Chorus</h3><p>Holy</p></section>')
  })

  it('sings a printed refrain once unless told to repeat it', () => {
    expect(arrangeHymnChorus(printed, 'once').map((section) => section.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Verse 3'])
    expect(arrangeHymnChorus(printed, 'each').map((section) => section.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus'])
    expect(hymnSlideHtml(printed, { chorus: 'once' })).toContain('<h3>2</h3><p>second</p></section><section><h3>3</h3>')
    expect(hymnSlideHtml(printed, { chorus: 'each' }).match(/<h3>Chorus<\/h3>/g)).toHaveLength(3)
  })

  it('changes the key of the chords only', () => {
    expect(hymnKeyFrom('F♯', 2)).toBe('G#')
    expect(hymnSlideHtml([{ label: 'Verse 1', lines: ['[F♯m]Sing out'] }], { mode: 'chords', semitones: 2 })).toContain('>G#m<')
    expect(hymnSlideHtml([{ label: 'Verse 1', lines: ['[F♯m]Sing out'] }], { semitones: 2 })).toBe(hymnSlideHtml([{ label: 'Verse 1', lines: ['[F♯m]Sing out'] }]))
  })

  it('centers a single column box but never the lyric lines', () => {
    expect(hymnSlideHtml(sections, { columns: 1 })).toContain('style="max-width:38em;margin:0 auto;text-align:left;column-count:1;')
    expect(hymnSlideHtml(sections, { columns: 2 })).toContain('style="max-width:none;text-align:left;column-count:2;column-gap:2.4em;')
    expect(hymnSlideHtml(sections, { columns: 3 })).toContain('column-count:3;column-gap:1.8em;')
  })

  it('leaves a hymn without a chorus alone', () => {
    const verses = [{ label: 'Verse 1', lines: ['only'] }]
    expect(arrangeHymnChorus(verses, 'each')).toEqual(verses)
  })

  it('sizes the type by wrapped lines, so narrow columns still fit', () => {
    expect(hymnLayoutFor([{ label: 'Verse 1', lines: ['short line'] }], 1)).toEqual({ fontSize: 1, lineHeight: 1.35, columnGap: 0, fits: true })
    expect(hymnLayoutFor(longLines, 1)).toEqual({ fontSize: .72, lineHeight: 1.12, columnGap: 0, fits: true })
    expect(hymnLayoutFor(longLines, 3).fontSize).toBeLessThan(hymnLayoutFor(longLines, 1).fontSize)
    expect(hymnLayoutFor([{ label: 'Verse 1', lines: Array.from({ length: 12 }, () => 'x'.repeat(40)) }], 3).fontSize).toBe(.72)
    expect(hymnLayoutFor(sections, 2, 'chords').lineHeight).toBe(1.5)
    expect(hymnLayoutFor(longLines, 1, 'chords').lineHeight).toBeGreaterThan(hymnLayoutFor(longLines, 1).lineHeight)
  })

  it('warns when a hymn cannot be held by one slide', () => {
    const massive = [{ label: 'Verse 1', lines: Array.from({ length: 40 }, () => 'x'.repeat(90)) }]
    expect(hymnLayoutFor(massive, 1).fits).toBe(false)
    expect(hymnLayoutFor(massive, 3).fits).toBe(false)
    expect(hymnLayoutFor(sections, 1).fits).toBe(true)
  })
})
