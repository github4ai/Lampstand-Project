export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}
export function tuneDuration(notes: Array<{ beats: number }>, bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0
  return notes.reduce((total, note) => total + Math.max(0, note.beats), 0) * 60 / bpm
}
