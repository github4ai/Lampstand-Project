import { describe, expect, it } from 'vitest'
import { midiToFrequency, tuneDuration } from './tune'
describe('hymn tune helpers', () => {
  it('converts MIDI notes to frequencies', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2)
  })
  it('calculates duration from beats and tempo', () => {
    expect(tuneDuration([{ beats: 1 }, { beats: 2 }], 60)).toBe(3)
    expect(tuneDuration([{ beats: 1 }], 0)).toBe(0)
  })
})
