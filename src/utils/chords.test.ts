import { describe, expect, it } from 'vitest'
import { extractChords, semitonesBetween, stripChords, transposeChord, transposeChordLine } from './chords'

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
