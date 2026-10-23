import { describe, expect, it } from 'vitest'
import { extractChords, semitonesBetween, splitChordTokens, stripChords, transposeChord, transposeChordLine } from './chords'

describe('hymnal chord transposition', () => {
  it('transposes simple, minor, seventh, and slash chords', () => {
    expect(transposeChord('G', 2)).toBe('A')
    expect(transposeChord('Em', 2)).toBe('F#m')
    expect(transposeChord('D7', 2)).toBe('E7')
    expect(transposeChord('G/B', 2)).toBe('A/C#')
  })

  it('transposes chord markers without changing lyrics', () => {
    expect(transposeChordLine('[G]Amazing [C]grace', 2))
      .toBe('[A]Amazing [D]grace')
  })

  it('calculates the interval between keys', () => {
    expect(semitonesBetween('G', 'C')).toBe(5)
    expect(semitonesBetween('Bb', 'C')).toBe(2)
  })

  it('supports lyric and guitar views', () => {
    expect(stripChords('[G]Amazing [C]grace')).toBe('Amazing grace')
    expect(extractChords(['[G]Grace [C]alone', '[G]Amen [D7]'], 2))
      .toEqual(['A', 'D', 'E7'])
  })
})

describe('parenthetical chord markers', () => {
  it('transposes (C) markers the same way as [C]', () => {
    expect(transposeChordLine('(C)Amazing (G7)grace', 2)).toBe('(D)Amazing (A7)grace')
  })

  it('handles both marker styles on one line', () => {
    expect(transposeChordLine('[C]A (Dm)B', 2)).toBe('[D]A (Em)B')
  })

  it('transposes compound, quality, and slash chords', () => {
    expect(transposeChordLine('(Em7) (F#m) (C/G) (Gsus4)', 2))
      .toBe('(F#m7) (G#m) (D/A) (Asus4)')
  })

  it('strips parenthetical chords from the lyrics view', () => {
    expect(stripChords('(C)Amazing (G7)grace')).toBe('Amazing grace')
  })

  it('keeps lyric asides that do not read as a chord', () => {
    expect(stripChords('(repeat) after [C]chorus')).toBe('(repeat) after chorus')
    expect(stripChords('(Chorus) (Go) (in)')).toBe('(Chorus) (Go) (in)')
  })

  it('reads a bare (B) section label as a chord and removes it', () => {
    expect(stripChords('(B) second part')).toBe(' second part')
  })

  it('collects chords from both marker styles without duplicates', () => {
    expect(extractChords(['[C]A (Dm)B', '(G)C [Em]D', '(G)again'], 0))
      .toEqual(['C', 'Dm', 'G', 'Em'])
  })
})

describe('chord token splitting', () => {
  it('splits a line into chord and lyric tokens in order', () => {
    expect(splitChordTokens('[C]Sing (G7)out')).toEqual([
      { type: 'chord', value: 'C' },
      { type: 'lyric', value: 'Sing ' },
      { type: 'chord', value: 'G7' },
      { type: 'lyric', value: 'out' },
    ])
  })

  it('returns the whole line as lyric when there is no chord', () => {
    expect(splitChordTokens('Sing aloud')).toEqual([{ type: 'lyric', value: 'Sing aloud' }])
    expect(splitChordTokens('(Ref) Sing')).toEqual([{ type: 'lyric', value: '(Ref) Sing' }])
  })

  it('returns nothing for an empty line', () => {
    expect(splitChordTokens('')).toEqual([])
  })
})
