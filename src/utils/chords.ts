export const CHROMATIC_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

const PARENTHETICAL_CHORD = /\(([A-G](?:#|b)?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\d+|\d+|[+°ø])*(?:\/[A-G](?:#|b)?)?)\)/g

const FLATS: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
}

function noteIndex(note: string): number {
  return CHROMATIC_KEYS.indexOf((FLATS[note] ?? note) as typeof CHROMATIC_KEYS[number])
}

function transposeNote(note: string, semitones: number): string {
  const index = noteIndex(note)
  if (index < 0) return note
  return CHROMATIC_KEYS[(index + semitones + 120) % 12]
}

export function semitonesBetween(from: string, to: string): number {
  const start = noteIndex(from)
  const end = noteIndex(to)
  return start < 0 || end < 0 ? 0 : (end - start + 12) % 12
}

export function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return chord
  const [, root, suffix] = match
  return transposeNote(root, semitones) +
    suffix.replace(/\/([A-G](?:#|b)?)/g, (_, note: string) => '/' + transposeNote(note, semitones))
}

export function transposeChordLine(line: string, semitones: number): string {
  return line
    .replace(/\[([^\]]+)\]/g, (_, chord: string) => '[' + transposeChord(chord, semitones) + ']')
    .replace(PARENTHETICAL_CHORD, (_, chord: string) => '(' + transposeChord(chord, semitones) + ')')
}

export function stripChords(line: string): string {
  // Some imported hymn files use (C) rather than [C]. Only remove a
  // parenthetical marker when it begins with a valid chord root, so normal
  // lyric asides such as "(repeat)" remain visible.
  return line.replace(/\[[^\]]+\]/g, '').replace(PARENTHETICAL_CHORD, '')
}

export function extractChords(lines: string[], semitones: number): string[] {
  const chords = lines.flatMap((line) =>
    [...transposeChordLine(line, semitones).matchAll(/\[([^\]]+)\]|\(([A-G](?:#|b)?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\d+|\d+|[+°ø])*(?:\/[A-G](?:#|b)?)?)\)/g)]
      .map((match) => match[1] ?? match[2]))
  return [...new Set(chords)]
}
